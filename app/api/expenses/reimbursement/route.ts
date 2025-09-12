import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for reimbursement processing
const processReimbursementSchema = z.object({
  expenseIds: z.array(z.string()).min(1, 'At least one expense ID is required'),
  reimbursementDate: z.string().transform((str) => new Date(str)).optional(),
  batchId: z.string().optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE']).default('BANK_TRANSFER'),
  referenceNumber: z.string().optional(),
  notes: z.string().optional()
})

const reimbursementQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  employeeId: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  batchId: z.string().optional()
})

// GET /api/expenses/reimbursement - Get reimbursement records
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    const canProcessReimbursements = ['ADMIN', 'FINANCE', 'HR'].includes(user?.role || '')
    
    if (!canProcessReimbursements) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = reimbursementQuerySchema.parse(Object.fromEntries(searchParams))

    // Build filter conditions
    const where: any = {}

    if (query.status) {
      where.reimbursementStatus = query.status
    }

    if (query.employeeId) {
      where.employeeId = query.employeeId
    }

    if (query.startDate && query.endDate) {
      where.reimbursedAt = {
        gte: query.startDate,
        lte: query.endDate
      }
    }

    if (query.batchId) {
      where.reimbursementBatchId = query.batchId
    }

    // Get total count
    const totalCount = await prisma.expenseClaim.count({
      where: {
        ...where,
        status: 'APPROVED',
        isReimbursable: true
      }
    })

    // Get reimbursement records
    const reimbursements = await prisma.expenseClaim.findMany({
      where: {
        ...where,
        status: 'APPROVED',
        isReimbursable: true
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            email: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: { approvedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    })

    return NextResponse.json({
      data: reimbursements,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / query.limit)
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching reimbursements:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/expenses/reimbursement - Process reimbursements
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const canProcessReimbursements = ['ADMIN', 'FINANCE', 'HR'].includes(user?.role || '')
    
    if (!canProcessReimbursements) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = processReimbursementSchema.parse(body)

    // Validate expense claims
    const expenseClaims = await prisma.expenseClaim.findMany({
      where: {
        id: { in: validatedData.expenseIds },
        status: 'APPROVED',
        isReimbursable: true,
        reimbursedAt: null // Not already reimbursed
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            email: true
          }
        }
      }
    })

    if (expenseClaims.length === 0) {
      return NextResponse.json(
        { error: 'No valid expense claims found for reimbursement' },
        { status: 400 }
      )
    }

    if (expenseClaims.length !== validatedData.expenseIds.length) {
      return NextResponse.json(
        { error: 'Some expense claims are not eligible for reimbursement' },
        { status: 400 }
      )
    }

    // Generate batch ID if not provided
    const batchId = validatedData.batchId || `REIMB-${Date.now()}`
    const reimbursementDate = validatedData.reimbursementDate || new Date()

    // Calculate total reimbursement amount
    const totalAmount = expenseClaims.reduce(
      (sum, claim) => sum + claim.amount.toNumber(),
      0
    )

    // Create reimbursement batch record
    const reimbursementBatch = await prisma.reimbursementBatch.create({
      data: {
        batchId,
        totalAmount,
        totalClaims: expenseClaims.length,
        paymentMethod: validatedData.paymentMethod,
        referenceNumber: validatedData.referenceNumber,
        notes: validatedData.notes,
        processedBy: session.user.id,
        processedAt: reimbursementDate,
        status: 'PROCESSING'
      }
    })

    // Update expense claims with reimbursement information
    await prisma.expenseClaim.updateMany({
      where: {
        id: { in: validatedData.expenseIds }
      },
      data: {
        status: 'REIMBURSED',
        reimbursedAt: reimbursementDate,
        reimbursedBy: session.user.id,
        reimbursementAmount: undefined, // Will be set individually
        reimbursementBatchId: reimbursementBatch.id
      }
    })

    // Update individual reimbursement amounts
    for (const claim of expenseClaims) {
      await prisma.expenseClaim.update({
        where: { id: claim.id },
        data: {
          reimbursementAmount: claim.amount
        }
      })
    }

    // Send notifications to employees and finance team
    try {
      // Group claims by employee for notifications
      const employeeClaimsMap = new Map()
      expenseClaims.forEach(claim => {
        const empId = claim.employee.id
        if (!employeeClaimsMap.has(empId)) {
          employeeClaimsMap.set(empId, {
            employee: claim.employee,
            claims: [],
            totalAmount: 0
          })
        }
        const empData = employeeClaimsMap.get(empId)
        empData.claims.push(claim)
        empData.totalAmount += claim.amount.toNumber()
      })

      // Prepare employee notifications
      const employeeNotifications = Array.from(employeeClaimsMap.values()).map(empData => ({
        employeeEmail: empData.employee.email,
        employeeName: `${empData.employee.firstName} ${empData.employee.lastName}`,
        type: 'PROCESSING' as const,
        batchId,
        amount: empData.totalAmount,
        claimCount: empData.claims.length,
        paymentMethod: validatedData.paymentMethod
      }))

      // Send employee notifications
      const { emailService } = await import('@/lib/email-service')
      await emailService.sendBulkReimbursementNotifications(employeeNotifications)

      // Send finance team notification
      await emailService.sendFinanceTeamNotification({
        type: 'BATCH_CREATED',
        batchId,
        totalAmount,
        totalClaims: expenseClaims.length,
        processedBy: session.user.email || session.user.id
      })

      console.log(`📧 Sent reimbursement notifications for batch ${batchId}`)
    } catch (notificationError) {
      console.error('Error sending reimbursement notifications:', notificationError)
      // Don't fail the main process if notifications fail
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REIMBURSEMENT_PROCESSED',
        resource: 'EXPENSE_CLAIM',
        details: {
          batchId,
          expenseIds: validatedData.expenseIds,
          totalAmount,
          paymentMethod: validatedData.paymentMethod
        }
      }
    })

    // Get updated expense claims for response
    const updatedClaims = await prisma.expenseClaim.findMany({
      where: {
        id: { in: validatedData.expenseIds }
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            email: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Reimbursements processed successfully',
      batchId,
      totalAmount,
      processedClaims: updatedClaims.length,
      claims: updatedClaims
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing reimbursements:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/email-service'
import { z } from 'zod'

const batchesQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional()
})

const updateBatchStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'COMPLETED', 'FAILED']),
  referenceNumber: z.string().optional(),
  failureReason: z.string().optional(),
  completedAt: z.string().transform((str) => new Date(str)).optional(),
  sendNotifications: z.boolean().default(true)
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const canViewBatches = ['ADMIN', 'FINANCE', 'HR'].includes(user?.role || '')
    
    if (!canViewBatches) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = batchesQuerySchema.parse(Object.fromEntries(searchParams))

    // Build filter conditions
    const where: any = {}

    if (query.status) {
      where.status = query.status
    }

    if (query.startDate && query.endDate) {
      where.processedAt = {
        gte: query.startDate,
        lte: query.endDate
      }
    }

    // Get total count
    const totalCount = await prisma.reimbursementBatch.count({ where })

    // Get reimbursement batches
    const batches = await prisma.reimbursementBatch.findMany({
      where,
      include: {
        expenseClaims: {
          select: {
            id: true,
            title: true,
            amount: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeCode: true
              }
            }
          }
        }
      },
      orderBy: { processedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    })

    return NextResponse.json({
      batches,
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

    console.error('Error fetching reimbursement batches:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/expenses/reimbursement/batches - Update batch status and payment tracking
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const canUpdateBatches = ['ADMIN', 'FINANCE'].includes(user?.role || '')
    
    if (!canUpdateBatches) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')

    if (!batchId) {
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateBatchStatusSchema.parse(body)

    // Find the batch
    const batch = await prisma.reimbursementBatch.findUnique({
      where: { id: batchId },
      include: {
        expenseClaims: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                employeeCode: true
              }
            }
          }
        }
      }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      status: validatedData.status,
      updatedAt: new Date()
    }

    if (validatedData.referenceNumber) {
      updateData.referenceNumber = validatedData.referenceNumber
    }

    if (validatedData.status === 'COMPLETED') {
      updateData.completedAt = validatedData.completedAt || new Date()
    } else if (validatedData.status === 'FAILED') {
      updateData.failedAt = new Date()
      updateData.failureReason = validatedData.failureReason
    }

    // Update batch status
    const updatedBatch = await prisma.reimbursementBatch.update({
      where: { id: batchId },
      data: updateData
    })

    // Update expense claims status if batch is completed
    if (validatedData.status === 'COMPLETED') {
      await prisma.expenseClaim.updateMany({
        where: { reimbursementBatchId: batchId },
        data: {
          status: 'REIMBURSED',
          reimbursedAt: updateData.completedAt
        }
      })
    } else if (validatedData.status === 'FAILED') {
      // Revert expense claims back to approved status for retry
      await prisma.expenseClaim.updateMany({
        where: { reimbursementBatchId: batchId },
        data: {
          status: 'APPROVED',
          reimbursedAt: null,
          reimbursementBatchId: null
        }
      })
    }

    // Send notifications if requested
    if (validatedData.sendNotifications && batch.expenseClaims.length > 0) {
      await sendBatchStatusNotifications(batch, validatedData.status, validatedData.failureReason)
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REIMBURSEMENT_BATCH_STATUS_UPDATED',
        resource: 'REIMBURSEMENT_BATCH',
        details: {
          batchId: batch.batchId,
          oldStatus: batch.status,
          newStatus: validatedData.status,
          referenceNumber: validatedData.referenceNumber,
          failureReason: validatedData.failureReason
        }
      }
    })

    return NextResponse.json({
      message: 'Batch status updated successfully',
      batch: updatedBatch
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating batch status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to send batch status notifications
async function sendBatchStatusNotifications(
  batch: any,
  status: string,
  failureReason?: string
) {
  try {
    const employees = batch.expenseClaims.map((claim: any) => claim.employee)
    const uniqueEmployees = employees.filter((emp: any, index: number, self: any[]) => 
      self.findIndex(e => e.id === emp.id) === index
    )

    for (const employee of uniqueEmployees) {
      const employeeClaims = batch.expenseClaims.filter((claim: any) => 
        claim.employee.id === employee.id
      )
      
      const totalAmount = employeeClaims.reduce((sum: number, claim: any) => 
        sum + claim.amount.toNumber(), 0
      )

      let subject: string
      let message: string

      if (status === 'COMPLETED') {
        subject = `Reimbursement Payment Processed - Batch ${batch.batchId}`
        message = `Dear ${employee.firstName} ${employee.lastName},

Your reimbursement payment has been successfully processed.

Batch Details:
- Batch ID: ${batch.batchId}
- Payment Method: ${batch.paymentMethod}
- Reference Number: ${batch.referenceNumber || 'N/A'}
- Total Amount: ₹${totalAmount.toLocaleString()}
- Number of Claims: ${employeeClaims.length}

The payment should reflect in your account within 1-2 business days.

If you have any questions, please contact the Finance team.

Best regards,
Finance Team`
      } else if (status === 'FAILED') {
        subject = `Reimbursement Payment Failed - Batch ${batch.batchId}`
        message = `Dear ${employee.firstName} ${employee.lastName},

Unfortunately, your reimbursement payment could not be processed due to technical issues.

Batch Details:
- Batch ID: ${batch.batchId}
- Total Amount: ₹${totalAmount.toLocaleString()}
- Number of Claims: ${employeeClaims.length}
- Failure Reason: ${failureReason || 'Technical error'}

Your expense claims have been reset to approved status and will be included in the next payment batch.

We apologize for the inconvenience. If you have any questions, please contact the Finance team.

Best regards,
Finance Team`
      } else {
        continue // Skip other statuses
      }

      await emailService.sendEmail({
        to: employee.email,
        subject,
        html: message.replace(/\n/g, '<br>'),
        text: message
      })
    }

    console.log(`📧 Sent batch status notifications to ${uniqueEmployees.length} employees`)
  } catch (error) {
    console.error('Error sending batch notifications:', error)
  }
}
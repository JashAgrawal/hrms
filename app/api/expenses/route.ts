import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for expense claim creation
const createExpenseSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  expenseDate: z.string().transform((str) => new Date(str)),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional()
  }).optional(),
  merchantName: z.string().optional(),
  merchantAddress: z.string().optional(),
  billNumber: z.string().optional(),
  taxAmount: z.number().optional(),
  taxRate: z.number().optional(),
  distanceTraveled: z.number().optional(),
  vehicleNumber: z.string().optional(),
  travelRequestId: z.string().optional()
})

// GET /api/expenses - Get expense claims for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const categoryId = searchParams.get('categoryId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Get employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Build filter conditions
    const where: any = {
      employeeId: employee.id
    }

    if (status) {
      where.status = status
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (startDate && endDate) {
      where.expenseDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.expenseClaim.count({ where })

    // Get expense claims with pagination
    const expenseClaims = await prisma.expenseClaim.findMany({
      where,
      include: {
        category: true,
        attachments: true,
        approvals: {
          orderBy: { level: 'asc' }
        },
        travelRequest: {
          select: {
            id: true,
            title: true,
            destination: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    return NextResponse.json({
      data: expenseClaims,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching expense claims:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/expenses - Create a new expense claim
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createExpenseSchema.parse(body)

    // Get employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Validate expense category exists
    const category = await prisma.expenseCategory.findUnique({
      where: { id: validatedData.categoryId },
      include: { policyRules: true }
    })

    if (!category || !category.isActive) {
      return NextResponse.json({ error: 'Invalid expense category' }, { status: 400 })
    }

    // Validate policy rules
    const policyViolations = []
    
    // Check amount limit
    if (category.maxAmount && validatedData.amount > category.maxAmount.toNumber()) {
      policyViolations.push({
        rule: 'AMOUNT_LIMIT',
        message: `Amount exceeds maximum limit of ${category.maxAmount}`
      })
    }

    // Check if receipt is required
    if (category.requiresReceipt) {
      // Note: Attachments will be uploaded separately
      // This validation will be handled in the attachment upload endpoint
    }

    // Create expense claim
    const expenseClaim = await prisma.expenseClaim.create({
      data: {
        employeeId: employee.id,
        categoryId: validatedData.categoryId,
        title: validatedData.title,
        description: validatedData.description,
        amount: validatedData.amount,
        expenseDate: validatedData.expenseDate,
        location: validatedData.location,
        merchantName: validatedData.merchantName,
        merchantAddress: validatedData.merchantAddress,
        billNumber: validatedData.billNumber,
        taxAmount: validatedData.taxAmount,
        taxRate: validatedData.taxRate,
        distanceTraveled: validatedData.distanceTraveled,
        vehicleNumber: validatedData.vehicleNumber,
        travelRequestId: validatedData.travelRequestId,
        policyViolations: policyViolations.length > 0 ? policyViolations : undefined
      },
      include: {
        category: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true
          }
        }
      }
    })

    // Create approval workflow if required
    if (category.requiresApproval && category.approvalLevels > 0) {
      // Get reporting manager for first level approval
      const manager = await prisma.employee.findUnique({
        where: { id: employee.reportingTo || '' },
        include: { user: true }
      })

      if (manager) {
        await prisma.expenseApproval.create({
          data: {
            expenseId: expenseClaim.id,
            approverId: manager.userId,
            approverName: `${manager.firstName} ${manager.lastName}`,
            approverEmail: manager.email,
            level: 1
          }
        })
      }
    }

    return NextResponse.json(expenseClaim, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating expense claim:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
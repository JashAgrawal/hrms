import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const createExpenseClaimSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('INR'),
  expenseDate: z.string().transform((str) => new Date(str)),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
  }).optional(),
  merchantName: z.string().optional(),
  merchantAddress: z.string().optional(),
  billNumber: z.string().optional(),
  taxAmount: z.number().optional(),
  taxRate: z.number().optional(),
  distanceTraveled: z.number().optional(),
  vehicleNumber: z.string().optional(),
})

// GET /api/expense-claims - List expense claims
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    const categoryId = searchParams.get('categoryId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Build where clause based on user role and filters
    const whereClause: any = {}

    // Role-based filtering
    if (user.role === 'EMPLOYEE') {
      whereClause.employeeId = user.employee.id
    } else if (employeeId) {
      whereClause.employeeId = employeeId
    }

    // Additional filters
    if (status) {
      whereClause.status = status
    }
    if (categoryId) {
      whereClause.categoryId = categoryId
    }
    if (startDate || endDate) {
      whereClause.expenseDate = {}
      if (startDate) whereClause.expenseDate.gte = new Date(startDate)
      if (endDate) whereClause.expenseDate.lte = new Date(endDate)
    }

    const [expenseClaims, totalCount] = await Promise.all([
      prisma.expenseClaim.findMany({
        where: whereClause,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              thumbnailUrl: true,
            },
          },
          approvals: {
            include: {
              expense: false,
            },
            orderBy: { level: 'asc' },
          },
          travelRequest: {
            select: {
              id: true,
              title: true,
              destination: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.expenseClaim.count({ where: whereClause }),
    ])

    return NextResponse.json({
      data: expenseClaims,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching expense claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense claims' },
      { status: 500 }
    )
  }
}

// POST /api/expense-claims - Create new expense claim
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = createExpenseClaimSchema.parse(body)

    // Validate expense category exists and is active
    const category = await prisma.expenseCategory.findUnique({
      where: { id: validatedData.categoryId },
      include: { policyRules: { where: { isActive: true } } },
    })

    if (!category || !category.isActive) {
      return NextResponse.json(
        { error: 'Invalid or inactive expense category' },
        { status: 400 }
      )
    }

    // Validate policy rules
    const policyViolations: string[] = []

    // Check amount limits
    if (category.maxAmount && validatedData.amount > Number(category.maxAmount)) {
      policyViolations.push(`Amount exceeds maximum limit of ${category.maxAmount}`)
    }

    // Check policy rules
    for (const rule of category.policyRules) {
      const ruleValue = rule.ruleValue as any
      
      if (rule.ruleType === 'AMOUNT_LIMIT' && ruleValue.maxAmount) {
        if (validatedData.amount > ruleValue.maxAmount) {
          policyViolations.push(`Amount exceeds policy limit of ${ruleValue.maxAmount}`)
        }
      }
    }

    // Create expense claim
    const expenseClaim = await prisma.expenseClaim.create({
      data: {
        ...validatedData,
        employeeId: user.employee.id,
        policyViolations: policyViolations.length > 0 ? policyViolations : undefined,
        status: policyViolations.length > 0 ? 'PENDING' : 'PENDING',
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        attachments: true,
      },
    })

    // Create approval workflow if required
    if (category.requiresApproval) {
      const approvals = []
      for (let level = 1; level <= category.approvalLevels; level++) {
        // For now, create pending approvals - in a real system, you'd determine approvers based on hierarchy
        approvals.push({
          expenseId: expenseClaim.id,
          approverId: user.employee.reportingTo || user.id, // Fallback to user if no manager
          level,
          status: 'PENDING' as const,
        })
      }

      if (approvals.length > 0) {
        await prisma.expenseApproval.createMany({
          data: approvals,
        })
      }
    }

    return NextResponse.json(expenseClaim, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating expense claim:', error)
    return NextResponse.json(
      { error: 'Failed to create expense claim' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const createTravelExpenseSchema = z.object({
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

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/travel-requests/[id]/expenses - Get expenses for travel request
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Verify travel request exists and user has access
    const travelRequest = await prisma.travelRequest.findUnique({
      where: { id: id },
      include: {
        employee: true,
      },
    })

    if (!travelRequest) {
      return NextResponse.json({ error: 'Travel request not found' }, { status: 404 })
    }

    // Check access permissions
    const canAccess = 
      user.role === 'ADMIN' ||
      user.role === 'HR' ||
      travelRequest.employeeId === user.employee.id ||
      (user.role === 'MANAGER' && user.employee.id === travelRequest.employee.reportingTo)

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get expense claims for this travel request
    const expenseClaims = await prisma.expenseClaim.findMany({
      where: { travelRequestId: id },
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
          orderBy: { level: 'asc' },
        },
      },
      orderBy: { expenseDate: 'desc' },
    })

    // Calculate totals
    const totalExpenses = expenseClaims.reduce((sum, claim) => sum + Number(claim.amount), 0)
    const approvedExpenses = expenseClaims
      .filter(claim => claim.status === 'APPROVED')
      .reduce((sum, claim) => sum + Number(claim.amount), 0)
    const pendingExpenses = expenseClaims
      .filter(claim => claim.status === 'PENDING')
      .reduce((sum, claim) => sum + Number(claim.amount), 0)

    return NextResponse.json({
      travelRequest: {
        id: travelRequest.id,
        title: travelRequest.title,
        estimatedCost: travelRequest.estimatedCost,
        actualCost: travelRequest.actualCost,
        status: travelRequest.status,
      },
      expenses: expenseClaims,
      summary: {
        totalExpenses,
        approvedExpenses,
        pendingExpenses,
        estimatedVsActual: {
          estimated: Number(travelRequest.estimatedCost),
          actual: totalExpenses,
          variance: totalExpenses - Number(travelRequest.estimatedCost),
          variancePercentage: Number(travelRequest.estimatedCost) > 0
            ? ((totalExpenses - Number(travelRequest.estimatedCost)) / Number(travelRequest.estimatedCost)) * 100
            : 0,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching travel expenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch travel expenses' },
      { status: 500 }
    )
  }
}

// POST /api/travel-requests/[id]/expenses - Create expense claim for travel request
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Verify travel request exists and is approved
    const travelRequest = await prisma.travelRequest.findUnique({
      where: { id: id },
    })

    if (!travelRequest) {
      return NextResponse.json({ error: 'Travel request not found' }, { status: 404 })
    }

    if (travelRequest.employeeId !== user.employee.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (travelRequest.status !== 'APPROVED' && travelRequest.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Can only create expenses for approved travel requests' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = createTravelExpenseSchema.parse(body)

    // Validate expense date is within travel period
    const expenseDate = validatedData.expenseDate
    const travelStart = new Date(travelRequest.startDate)
    const travelEnd = new Date(travelRequest.endDate)
    
    // Allow expenses up to 7 days after travel end date
    const allowedEndDate = new Date(travelEnd)
    allowedEndDate.setDate(allowedEndDate.getDate() + 7)

    if (expenseDate < travelStart || expenseDate > allowedEndDate) {
      return NextResponse.json(
        { error: 'Expense date must be within travel period (or up to 7 days after)' },
        { status: 400 }
      )
    }

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

    // Check if total expenses would exceed estimated cost
    const existingExpenses = await prisma.expenseClaim.aggregate({
      where: { travelRequestId: id },
      _sum: { amount: true },
    })

    const currentTotal = Number(existingExpenses._sum.amount) || 0
    const newTotal = currentTotal + validatedData.amount

    const policyViolations: string[] = []

    if (newTotal > Number(travelRequest.estimatedCost) * 1.2) { // Allow 20% variance
      policyViolations.push(
        `Total expenses (₹${newTotal.toLocaleString()}) would exceed 120% of estimated cost (₹${(Number(travelRequest.estimatedCost) * 1.2).toLocaleString()})`
      )
    }

    // Validate policy rules
    for (const rule of category.policyRules) {
      const ruleValue = rule.ruleValue as any
      
      if (rule.ruleType === 'AMOUNT_LIMIT' && ruleValue.maxAmount) {
        if (validatedData.amount > ruleValue.maxAmount) {
          policyViolations.push(`Amount exceeds policy limit of ₹${ruleValue.maxAmount}`)
        }
      }
    }

    // Create expense claim
    const expenseClaim = await prisma.expenseClaim.create({
      data: {
        ...validatedData,
        employeeId: user.employee.id,
        travelRequestId: id,
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
        travelRequest: {
          select: {
            id: true,
            title: true,
            destination: true,
          },
        },
      },
    })

    // Create approval workflow if required
    if (category.requiresApproval) {
      const approvals = []
      for (let level = 1; level <= category.approvalLevels; level++) {
        approvals.push({
          expenseId: expenseClaim.id,
          approverId: user.employee.reportingTo || user.id,
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

    // Update travel request actual cost
    const updatedTotal = currentTotal + validatedData.amount
    await prisma.travelRequest.update({
      where: { id: id },
      data: { actualCost: updatedTotal },
    })

    return NextResponse.json({
      ...expenseClaim,
      policyViolations,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating travel expense:', error)
    return NextResponse.json(
      { error: 'Failed to create travel expense' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for expense claim update
const updateExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  expenseDate: z.string().transform((str) => new Date(str)).optional(),
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
  vehicleNumber: z.string().optional()
})

// GET /api/expenses/[id] - Get a specific expense claim
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const expenseClaim = await prisma.expenseClaim.findUnique({
      where: { id: id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            email: true,
            userId: true,
            reportingTo: true
          }
        },
        category: true,
        attachments: true,
        approvals: {
          include: {
            expense: false
          },
          orderBy: { level: 'asc' }
        },
        travelRequest: {
          select: {
            id: true,
            title: true,
            destination: true,
            startDate: true,
            endDate: true
          }
        }
      }
    })

    if (!expenseClaim) {
      return NextResponse.json({ error: 'Expense claim not found' }, { status: 404 })
    }

    // Check if user has access to this expense claim
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    const canAccess = 
      expenseClaim.employee.userId === session.user.id || // Owner
      user?.role === 'ADMIN' || // Admin
      user?.role === 'HR' || // HR
      user?.role === 'FINANCE' || // Finance
      (user?.employee && expenseClaim.employee.reportingTo === user.employee.id) // Manager

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(expenseClaim)
  } catch (error) {
    console.error('Error fetching expense claim:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/expenses/[id] - Update an expense claim
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateExpenseSchema.parse(body)

    // Get existing expense claim
    const existingExpense = await prisma.expenseClaim.findUnique({
      where: { id: id },
      include: {
        employee: true,
        category: true
      }
    })

    if (!existingExpense) {
      return NextResponse.json({ error: 'Expense claim not found' }, { status: 404 })
    }

    // Check if user can update this expense claim
    if (existingExpense.employee.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if expense can be updated (only PENDING status)
    if (existingExpense.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot update expense claim that is not in pending status' },
        { status: 400 }
      )
    }

    // Validate policy rules if amount is being updated
    const policyViolations = []
    if (validatedData.amount && existingExpense.category.maxAmount) {
      if (validatedData.amount > existingExpense.category.maxAmount.toNumber()) {
        policyViolations.push({
          rule: 'AMOUNT_LIMIT',
          message: `Amount exceeds maximum limit of ${existingExpense.category.maxAmount}`
        })
      }
    }

    const updatedExpense = await prisma.expenseClaim.update({
      where: { id: id },
      data: {
        ...validatedData,
        policyViolations: policyViolations.length > 0 ? policyViolations : (existingExpense.policyViolations || undefined),
        updatedAt: new Date()
      },
      include: {
        category: true,
        attachments: true,
        approvals: {
          orderBy: { level: 'asc' }
        }
      }
    })

    return NextResponse.json(updatedExpense)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating expense claim:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/expenses/[id] - Delete an expense claim
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // Get existing expense claim
    const existingExpense = await prisma.expenseClaim.findUnique({
      where: { id: id },
      include: { employee: true }
    })

    if (!existingExpense) {
      return NextResponse.json({ error: 'Expense claim not found' }, { status: 404 })
    }

    // Check if user can delete this expense claim
    if (existingExpense.employee.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if expense can be deleted (only PENDING status)
    if (existingExpense.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot delete expense claim that is not in pending status' },
        { status: 400 }
      )
    }

    // Delete the expense claim (this will cascade delete attachments and approvals)
    await prisma.expenseClaim.delete({
      where: { id: id }
    })

    return NextResponse.json({ message: 'Expense claim deleted successfully' })
  } catch (error) {
    console.error('Error deleting expense claim:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const updateExpenseClaimSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  expenseDate: z.string().transform((str) => new Date(str)).optional(),
  merchantName: z.string().optional(),
  merchantAddress: z.string().optional(),
  billNumber: z.string().optional(),
  taxAmount: z.number().optional(),
  taxRate: z.number().optional(),
  distanceTraveled: z.number().optional(),
  vehicleNumber: z.string().optional(),
})

// GET /api/expense-claims/[id] - Get expense claim by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params
    const expenseClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            reportingTo: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            code: true,
            maxAmount: true,
            requiresReceipt: true,
          },
        },
        attachments: true,
        approvals: {
          orderBy: { level: 'asc' },
        },
        travelRequest: {
          select: {
            id: true,
            title: true,
            destination: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    })

    if (!expenseClaim) {
      return NextResponse.json(
        { error: 'Expense claim not found' },
        { status: 404 }
      )
    }

    // Check access permissions
    const canAccess = 
      user.role === 'ADMIN' ||
      user.role === 'FINANCE' ||
      user.role === 'HR' ||
      expenseClaim.employeeId === user.employee.id ||
      (user.role === 'MANAGER' && user.employee.id === expenseClaim.employee.reportingTo)

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(expenseClaim)
  } catch (error) {
    console.error('Error fetching expense claim:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense claim' },
      { status: 500 }
    )
  }
}

// PUT /api/expense-claims/[id] - Update expense claim
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params
    // Check if expense claim exists and user can edit it
    const existingClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        employeeId: true,
        status: true,
      },
    })

    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Expense claim not found' },
        { status: 404 }
      )
    }

    // Only allow editing if user owns the claim and it's still pending
    if (existingClaim.employeeId !== user.employee.id || existingClaim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot edit this expense claim' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateExpenseClaimSchema.parse(body)

    const updatedClaim = await prisma.expenseClaim.update({
      where: { id: resolvedParams.id },
      data: validatedData,
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
        approvals: {
          orderBy: { level: 'asc' },
        },
      },
    })

    return NextResponse.json(updatedClaim)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating expense claim:', error)
    return NextResponse.json(
      { error: 'Failed to update expense claim' },
      { status: 500 }
    )
  }
}

// DELETE /api/expense-claims/[id] - Delete expense claim
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params
    // Check if expense claim exists and user can delete it
    const existingClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        employeeId: true,
        status: true,
      },
    })

    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Expense claim not found' },
        { status: 404 }
      )
    }

    // Only allow deletion if user owns the claim and it's still pending
    if (existingClaim.employeeId !== user.employee.id || existingClaim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot delete this expense claim' },
        { status: 403 }
      )
    }

    // Delete related records first
    await prisma.$transaction([
      prisma.expenseAttachment.deleteMany({
        where: { expenseId: resolvedParams.id },
      }),
      prisma.expenseApproval.deleteMany({
        where: { expenseId: resolvedParams.id },
      }),
      prisma.expenseClaim.delete({
        where: { id: resolvedParams.id },
      }),
    ])

    return NextResponse.json({ message: 'Expense claim deleted successfully' })
  } catch (error) {
    console.error('Error deleting expense claim:', error)
    return NextResponse.json(
      { error: 'Failed to delete expense claim' },
      { status: 500 }
    )
  }
}
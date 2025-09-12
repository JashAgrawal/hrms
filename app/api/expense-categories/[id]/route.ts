import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const updateExpenseCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  maxAmount: z.number().positive().optional(),
  requiresReceipt: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  approvalLevels: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/expense-categories/[id] - Get expense category by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const category = await prisma.expenseCategory.findUnique({
      where: { id: resolvedParams.id },
      include: {
        policyRules: {
          where: { isActive: true },
        },
        _count: {
          select: {
            expenseClaims: true,
          },
        },
      },
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Expense category not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error fetching expense category:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense category' },
      { status: 500 }
    )
  }
}

// PUT /api/expense-categories/[id] - Update expense category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update expense categories
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['ADMIN', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resolvedParams = await params
    const body = await request.json()
    const validatedData = updateExpenseCategorySchema.parse(body)

    const category = await prisma.expenseCategory.update({
      where: { id: resolvedParams.id },
      data: validatedData,
      include: {
        policyRules: true,
        _count: {
          select: {
            expenseClaims: true,
          },
        },
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating expense category:', error)
    return NextResponse.json(
      { error: 'Failed to update expense category' },
      { status: 500 }
    )
  }
}

// DELETE /api/expense-categories/[id] - Delete expense category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete expense categories
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['ADMIN', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resolvedParams = await params
    // Check if category has any expense claims
    const expenseCount = await prisma.expenseClaim.count({
      where: { categoryId: resolvedParams.id },
    })

    if (expenseCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with existing expense claims' },
        { status: 400 }
      )
    }

    await prisma.expenseCategory.delete({
      where: { id: resolvedParams.id },
    })

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Error deleting expense category:', error)
    return NextResponse.json(
      { error: 'Failed to delete expense category' },
      { status: 500 }
    )
  }
}
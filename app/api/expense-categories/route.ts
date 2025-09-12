import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const createExpenseCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  maxAmount: z.number().positive().optional(),
  requiresReceipt: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  approvalLevels: z.number().int().min(1).default(1),
})

// GET /api/expense-categories - List all expense categories
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')

    const categories = await prisma.expenseCategory.findMany({
      where: {
        ...(isActive !== null && { isActive: isActive === 'true' }),
      },
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
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching expense categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense categories' },
      { status: 500 }
    )
  }
}

// POST /api/expense-categories - Create new expense category
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create expense categories (admin/finance)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['ADMIN', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createExpenseCategorySchema.parse(body)

    // Check if code already exists
    const existingCategory = await prisma.expenseCategory.findUnique({
      where: { code: validatedData.code },
    })

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category code already exists' },
        { status: 400 }
      )
    }

    const category = await prisma.expenseCategory.create({
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

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating expense category:', error)
    return NextResponse.json(
      { error: 'Failed to create expense category' },
      { status: 500 }
    )
  }
}
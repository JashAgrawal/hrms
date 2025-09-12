import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for expense category creation
const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  maxAmount: z.number().positive().optional(),
  requiresReceipt: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  approvalLevels: z.number().int().min(1).default(1)
})

// GET /api/expenses/categories - Get all active expense categories
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      include: {
        policyRules: {
          where: { isActive: true }
        },
        _count: {
          select: {
            expenseClaims: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching expense categories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/expenses/categories - Create a new expense category (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createCategorySchema.parse(body)

    // Check if category with same name or code already exists
    const existingCategory = await prisma.expenseCategory.findFirst({
      where: {
        OR: [
          { name: validatedData.name },
          { code: validatedData.code }
        ]
      }
    })

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category with this name or code already exists' },
        { status: 400 }
      )
    }

    const category = await prisma.expenseCategory.create({
      data: validatedData,
      include: {
        policyRules: true
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating expense category:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
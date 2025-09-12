import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { generateMonthlyPetrolExpense, calculatePetrolExpense } from '@/lib/utils/expense-policy'

const calculatePetrolExpenseSchema = z.object({
  distanceKm: z.number().positive('Distance must be positive'),
  ratePerKm: z.number().positive('Rate per km must be positive').optional(),
})

const generateMonthlyExpenseSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  month: z.number().int().min(1, 'Month must be 1-12').max(12, 'Month must be 1-12'),
  year: z.number().int().min(2020, 'Year too old').max(2030, 'Year too far in future'),
})

// GET /api/petrol-expenses - Get petrol expenses for employee
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
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

    // Date filters
    if (month && year) {
      whereClause.month = parseInt(month)
      whereClause.year = parseInt(year)
    } else if (year) {
      whereClause.year = parseInt(year)
    }

    const [petrolExpenses, totalCount] = await Promise.all([
      prisma.monthlyPetrolExpense.findMany({
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
          expenseClaim: {
            select: {
              id: true,
              status: true,
              approvedAt: true,
              reimbursedAt: true,
            },
          },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.monthlyPetrolExpense.count({ where: whereClause }),
    ])

    return NextResponse.json({
      data: petrolExpenses,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching petrol expenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch petrol expenses' },
      { status: 500 }
    )
  }
}

// POST /api/petrol-expenses/calculate - Calculate petrol expense for given distance
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { distanceKm, ratePerKm } = calculatePetrolExpenseSchema.parse(body)

    const result = await calculatePetrolExpense(distanceKm, ratePerKm)

    return NextResponse.json({
      distanceKm,
      ratePerKm: result.rate,
      totalAmount: result.amount,
      currency: 'INR',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error calculating petrol expense:', error)
    return NextResponse.json(
      { error: 'Failed to calculate petrol expense' },
      { status: 500 }
    )
  }
}
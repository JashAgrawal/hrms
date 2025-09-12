import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { 
  generateMonthlyPetrolExpensesForAllEmployees,
  generatePetrolExpensesForDepartment,
  getPetrolExpenseStats 
} from '@/lib/jobs/petrol-expense-scheduler'

const generateJobSchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2030).optional(),
  departmentId: z.string().optional(),
})

// POST /api/admin/petrol-expenses/generate-monthly - Run monthly petrol expense generation job
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin/finance permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['ADMIN', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { month, year, departmentId } = generateJobSchema.parse(body)

    // Default to previous month if not specified
    const now = new Date()
    const targetMonth = month || (now.getMonth() === 0 ? 12 : now.getMonth())
    const targetYear = year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())

    let result

    if (departmentId) {
      // Generate for specific department
      result = await generatePetrolExpensesForDepartment(departmentId, targetMonth, targetYear)
    } else {
      // Generate for all field employees
      result = await generateMonthlyPetrolExpensesForAllEmployees(targetMonth, targetYear)
    }

    // Get updated statistics
    const stats = await getPetrolExpenseStats(targetMonth, targetYear)

    return NextResponse.json({
      message: 'Monthly petrol expense generation completed',
      period: { month: targetMonth, year: targetYear },
      result,
      stats,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error running petrol expense generation job:', error)
    return NextResponse.json(
      { error: 'Failed to run petrol expense generation job' },
      { status: 500 }
    )
  }
}

// GET /api/admin/petrol-expenses/generate-monthly - Get generation statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin/finance/hr permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['ADMIN', 'FINANCE', 'HR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    // Default to current month if not specified
    const now = new Date()
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1
    const targetYear = year ? parseInt(year) : now.getFullYear()

    const stats = await getPetrolExpenseStats(targetMonth, targetYear)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching petrol expense generation stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generation statistics' },
      { status: 500 }
    )
  }
}
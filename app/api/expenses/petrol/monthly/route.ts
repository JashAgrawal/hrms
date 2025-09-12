import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/expenses/petrol/monthly - Get monthly petrol expenses for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    // Get employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Build filter conditions
    const where: any = {
      employeeId: employee.id,
      year
    }

    if (month) {
      where.month = month
    }

    const monthlyExpenses = await prisma.monthlyPetrolExpense.findMany({
      where,
      include: {
        expenseClaim: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
            approvedAt: true,
            reimbursedAt: true
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    })

    return NextResponse.json(monthlyExpenses)
  } catch (error) {
    console.error('Error fetching monthly petrol expenses:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/expenses/petrol/monthly - Generate monthly petrol expense claim
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { month, year } = body

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      )
    }

    // Get employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check if monthly expense already exists
    const existingExpense = await prisma.monthlyPetrolExpense.findUnique({
      where: {
        employeeId_month_year: {
          employeeId: employee.id,
          month,
          year
        }
      }
    })

    if (existingExpense) {
      return NextResponse.json(
        { error: 'Monthly petrol expense already exists for this period' },
        { status: 400 }
      )
    }

    // Get current petrol rate configuration
    const petrolConfig = await prisma.petrolExpenseConfig.findFirst({
      where: {
        isActive: true,
        effectiveFrom: {
          lte: new Date(year, month - 1, 1)
        },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date(year, month - 1, 1) } }
        ]
      },
      orderBy: { effectiveFrom: 'desc' }
    })

    if (!petrolConfig) {
      return NextResponse.json(
        { error: 'No active petrol rate configuration found' },
        { status: 400 }
      )
    }

    // Calculate total distance for the month from daily distance records
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // Last day of the month

    const dailyRecords = await prisma.dailyDistanceRecord.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    const totalDistance = dailyRecords.reduce((sum, record) => sum + record.totalDistance.toNumber(), 0)
    const totalAmount = totalDistance * petrolConfig.ratePerKm.toNumber()

    if (totalDistance === 0) {
      return NextResponse.json(
        { error: 'No distance records found for the specified month' },
        { status: 400 }
      )
    }

    // Get petrol expense category
    const petrolCategory = await prisma.expenseCategory.findFirst({
      where: { code: 'PETROL' }
    })

    if (!petrolCategory) {
      return NextResponse.json(
        { error: 'Petrol expense category not found' },
        { status: 400 }
      )
    }

    // Create expense claim first
    const expenseClaim = await prisma.expenseClaim.create({
      data: {
        employeeId: employee.id,
        categoryId: petrolCategory.id,
        title: `Petrol Expense - ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        description: `Auto-generated petrol expense for ${totalDistance.toFixed(2)} km at ₹${petrolConfig.ratePerKm}/km`,
        amount: totalAmount,
        expenseDate: endDate,
        isPetrolExpense: true,
        distanceTraveled: totalDistance,
        status: 'PENDING'
      }
    })

    // Create monthly petrol expense record
    const monthlyExpense = await prisma.monthlyPetrolExpense.create({
      data: {
        employeeId: employee.id,
        month,
        year,
        totalDistance,
        totalAmount,
        ratePerKm: petrolConfig.ratePerKm.toNumber(),
        expenseClaimId: expenseClaim.id
      },
      include: {
        expenseClaim: {
          select: {
            id: true,
            status: true,
            submittedAt: true
          }
        }
      }
    })

    // Create approval workflow if required
    if (petrolCategory.requiresApproval && petrolCategory.approvalLevels > 0) {
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

    return NextResponse.json(monthlyExpense, { status: 201 })
  } catch (error) {
    console.error('Error generating monthly petrol expense:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
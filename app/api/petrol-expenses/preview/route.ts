import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { calculatePetrolExpense } from '@/lib/utils/expense-policy'

// GET /api/petrol-expenses/preview - Get petrol expense preview for employee
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Determine target employee
    let targetEmployeeId = employeeId

    if (!targetEmployeeId) {
      targetEmployeeId = user.employee.id
    }

    // Check permissions - employees can only view their own preview
    if (user.role === 'EMPLOYEE' && targetEmployeeId !== user.employee.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate employee exists and is field employee
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        employeeType: true,
      },
    })

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (targetEmployee.employeeType !== 'FIELD_EMPLOYEE') {
      return NextResponse.json(
        { error: 'Petrol expense preview is only available for field employees' },
        { status: 400 }
      )
    }

    // Build date filter
    let dateFilter: any = {}

    if (month && year) {
      const monthNum = parseInt(month)
      const yearNum = parseInt(year)
      dateFilter = {
        gte: new Date(yearNum, monthNum - 1, 1),
        lte: new Date(yearNum, monthNum, 0),
      }
    } else if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    } else {
      // Default to current month
      const now = new Date()
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lte: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      }
    }

    // Get daily distance records
    const dailyRecords = await prisma.dailyDistanceRecord.findMany({
      where: {
        employeeId: targetEmployeeId,
        date: dateFilter,
      },
      orderBy: { date: 'desc' },
    })

    // Calculate totals
    const totalDistance = dailyRecords.reduce(
      (sum, record) => sum + record.totalDistance.toNumber(),
      0
    )

    // Get current petrol rate and calculate expense
    let petrolExpense = { amount: 0, rate: 0 }
    if (totalDistance > 0) {
      petrolExpense = await calculatePetrolExpense(totalDistance)
    }

    // Group by date for daily breakdown
    const dailyBreakdown = dailyRecords.map(record => ({
      date: record.date,
      distance: record.totalDistance.toNumber(),
      amount: record.totalDistance.toNumber() * petrolExpense.rate,
      checkInCount: record.checkInCount,
      isValidated: record.isValidated,
    }))

    // Check if monthly expense already exists
    let existingMonthlyExpense = null
    if (month && year) {
      existingMonthlyExpense = await prisma.monthlyPetrolExpense.findUnique({
        where: {
          employeeId_month_year: {
            employeeId: targetEmployeeId,
            month: parseInt(month),
            year: parseInt(year),
          },
        },
        include: {
          expenseClaim: {
            select: {
              id: true,
              status: true,
              approvedAt: true,
              reimbursedAt: true,
            },
          },
        },
      })
    }

    return NextResponse.json({
      employee: {
        id: targetEmployee.id,
        name: `${targetEmployee.firstName} ${targetEmployee.lastName}`,
        employeeCode: targetEmployee.employeeCode,
      },
      period: {
        startDate: dateFilter.gte,
        endDate: dateFilter.lte,
        month: month ? parseInt(month) : null,
        year: year ? parseInt(year) : null,
      },
      summary: {
        totalDistance,
        ratePerKm: petrolExpense.rate,
        totalAmount: petrolExpense.amount,
        currency: 'INR',
        daysWithTravel: dailyRecords.length,
      },
      dailyBreakdown,
      existingMonthlyExpense,
      canGenerate: !existingMonthlyExpense && totalDistance > 0,
    })
  } catch (error) {
    console.error('Error fetching petrol expense preview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch petrol expense preview' },
      { status: 500 }
    )
  }
}
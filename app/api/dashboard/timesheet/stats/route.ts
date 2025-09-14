import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/timesheet/stats - Get timesheet dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const employeeId = currentUser.employee.id
    const currentDate = new Date()
    const currentWeekStart = new Date(currentDate)
    currentWeekStart.setDate(currentDate.getDate() - currentDate.getDay())
    currentWeekStart.setHours(0, 0, 0, 0)

    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6)
    currentWeekEnd.setHours(23, 59, 59, 999)

    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    // Get total hours this week
    const weekTimeEntries = await prisma.timeEntry.findMany({
      where: {
        employeeId,
        date: {
          gte: currentWeekStart,
          lte: currentWeekEnd
        }
      }
    })

    const totalHoursThisWeek = weekTimeEntries.reduce((sum, entry) =>
      sum + Number(entry.billableHours) + Number(entry.nonBillableHours), 0
    )

    // Get total hours this month
    const monthTimeEntries = await prisma.timeEntry.findMany({
      where: {
        employeeId,
        date: {
          gte: currentMonthStart,
          lte: currentMonthEnd
        }
      }
    })

    const totalHoursThisMonth = monthTimeEntries.reduce((sum, entry) =>
      sum + Number(entry.billableHours) + Number(entry.nonBillableHours), 0
    )

    // Get active projects count
    const activeProjects = await prisma.project.count({
      where: {
        status: 'ACTIVE',
        timeEntries: {
          some: {
            employeeId
          }
        }
      }
    })

    // Get pending timesheets
    const pendingTimesheets = await prisma.timesheet.count({
      where: {
        employeeId,
        status: { in: ['DRAFT', 'SUBMITTED'] }
      }
    })

    // Get approved timesheets
    const approvedTimesheets = await prisma.timesheet.count({
      where: {
        employeeId,
        status: 'APPROVED'
      }
    })

    // Calculate utilization rate (assuming 40 hours per week as target)
    const targetHoursPerWeek = 40
    const utilizationRate = totalHoursThisWeek > 0 ?
      Math.min((totalHoursThisWeek / targetHoursPerWeek) * 100, 100) : 0

    const stats = {
      totalHoursThisWeek: Math.round(totalHoursThisWeek * 100) / 100,
      totalHoursThisMonth: Math.round(totalHoursThisMonth * 100) / 100,
      activeProjects,
      pendingTimesheets,
      approvedTimesheets,
      utilizationRate: Math.round(utilizationRate)
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching timesheet dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns'

// GET /api/leave/calendar - Get leave calendar data
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // YYYY-MM format
    const departmentId = searchParams.get('departmentId')
    const view = searchParams.get('view') || 'month' // month, week, day

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Parse date range based on view
    let startDate: Date
    let endDate: Date

    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      const monthStart = new Date(year, monthNum - 1, 1)
      
      if (view === 'month') {
        // Get full calendar month including partial weeks
        startDate = startOfWeek(startOfMonth(monthStart))
        endDate = endOfWeek(endOfMonth(monthStart))
      } else {
        startDate = startOfMonth(monthStart)
        endDate = endOfMonth(monthStart)
      }
    } else {
      // Default to current month
      const now = new Date()
      if (view === 'month') {
        startDate = startOfWeek(startOfMonth(now))
        endDate = endOfWeek(endOfMonth(now))
      } else {
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
      }
    }

    // Build where clause for leave requests
    const whereClause: any = {
      status: { in: ['APPROVED', 'PENDING'] },
      OR: [
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } }
          ]
        }
      ]
    }

    // Filter by department if specified
    if (departmentId) {
      whereClause.employee = {
        departmentId: departmentId
      }
    } else if (!['ADMIN', 'HR'].includes(currentUser.role)) {
      // Non-admin users can only see their department's calendar
      if (currentUser.employee?.departmentId) {
        whereClause.employee = {
          departmentId: currentUser.employee.departmentId
        }
      }
    }

    // Fetch leave requests
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: {
              select: {
                id: true,
                name: true,
                code: true,
              }
            }
          }
        },
        policy: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          }
        }
      },
      orderBy: { startDate: 'asc' }
    })

    // Get all days in the range
    const allDays = eachDayOfInterval({ start: startDate, end: endDate })

    // Create calendar data structure
    const calendarData = allDays.map(day => {
      const dayString = format(day, 'yyyy-MM-dd')
      
      // Find leave requests for this day
      const dayLeaves = leaveRequests.filter(request => {
        const requestStart = new Date(request.startDate)
        const requestEnd = new Date(request.endDate)
        return day >= requestStart && day <= requestEnd
      })

      return {
        date: dayString,
        dayOfWeek: day.getDay(),
        isWeekend: day.getDay() === 0 || day.getDay() === 6,
        leaves: dayLeaves.map(leave => ({
          id: leave.id,
          employee: {
            id: leave.employee.id,
            name: `${leave.employee.firstName} ${leave.employee.lastName}`,
            code: leave.employee.employeeCode,
            department: leave.employee.department,
          },
          policy: leave.policy,
          startDate: leave.startDate,
          endDate: leave.endDate,
          days: leave.days,
          status: leave.status,
          reason: leave.reason,
          isHalfDay: leave.isHalfDay,
          halfDayType: leave.halfDayType,
        })),
        leaveCount: dayLeaves.length,
        conflictCount: dayLeaves.length > 1 ? dayLeaves.length : 0,
      }
    })

    // Get department summary
    const departments = await prisma.department.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { id: departmentId } : {})
      },
      include: {
        _count: {
          select: {
            employees: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    })

    // Calculate leave statistics
    const totalEmployees = departments.reduce((sum, dept) => sum + dept._count.employees, 0)
    const employeesOnLeave = new Set(
      leaveRequests
        .filter(request => {
          const requestStart = new Date(request.startDate)
          const requestEnd = new Date(request.endDate)
          const today = new Date()
          return today >= requestStart && today <= requestEnd && request.status === 'APPROVED'
        })
        .map(request => request.employeeId)
    ).size

    const pendingRequests = leaveRequests.filter(request => request.status === 'PENDING').length

    // Find conflicts (multiple people on leave on same day)
    const conflictDays = calendarData.filter(day => day.conflictCount > 1)

    return NextResponse.json({
      calendar: calendarData,
      summary: {
        totalEmployees,
        employeesOnLeave,
        pendingRequests,
        conflictDays: conflictDays.length,
        departments: departments.map(dept => ({
          id: dept.id,
          name: dept.name,
          code: dept.code,
          employeeCount: dept._count.employees,
        }))
      },
      dateRange: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd'),
      }
    })
  } catch (error) {
    console.error('Error fetching leave calendar:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave calendar' },
      { status: 500 }
    )
  }
}

// POST /api/leave/calendar/conflicts - Check for leave conflicts
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { startDate, endDate, departmentId, excludeRequestId } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Build where clause
    const whereClause: any = {
      status: { in: ['APPROVED', 'PENDING'] },
      OR: [
        {
          AND: [
            { startDate: { lte: end } },
            { endDate: { gte: start } }
          ]
        }
      ]
    }

    if (excludeRequestId) {
      whereClause.id = { not: excludeRequestId }
    }

    if (departmentId) {
      whereClause.employee = {
        departmentId: departmentId
      }
    }

    // Find overlapping leave requests
    const overlappingRequests = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: {
              select: {
                name: true,
                code: true,
              }
            }
          }
        },
        policy: {
          select: {
            name: true,
            code: true,
            type: true,
          }
        }
      },
      orderBy: { startDate: 'asc' }
    })

    // Group conflicts by date
    const conflictsByDate: Record<string, any[]> = {}
    
    eachDayOfInterval({ start, end }).forEach(day => {
      const dayString = format(day, 'yyyy-MM-dd')
      const dayConflicts = overlappingRequests.filter(request => {
        const requestStart = new Date(request.startDate)
        const requestEnd = new Date(request.endDate)
        return day >= requestStart && day <= requestEnd
      })

      if (dayConflicts.length > 0) {
        conflictsByDate[dayString] = dayConflicts.map(request => ({
          id: request.id,
          employee: {
            name: `${request.employee.firstName} ${request.employee.lastName}`,
            code: request.employee.employeeCode,
            department: request.employee.department,
          },
          policy: request.policy,
          status: request.status,
          startDate: request.startDate,
          endDate: request.endDate,
        }))
      }
    })

    const hasConflicts = Object.keys(conflictsByDate).length > 0
    const maxConflictsPerDay = Math.max(
      ...Object.values(conflictsByDate).map(conflicts => conflicts.length),
      0
    )

    return NextResponse.json({
      hasConflicts,
      maxConflictsPerDay,
      conflictsByDate,
      totalConflictDays: Object.keys(conflictsByDate).length,
      summary: {
        totalOverlapping: overlappingRequests.length,
        byStatus: {
          approved: overlappingRequests.filter(r => r.status === 'APPROVED').length,
          pending: overlappingRequests.filter(r => r.status === 'PENDING').length,
        }
      }
    })
  } catch (error) {
    console.error('Error checking leave conflicts:', error)
    return NextResponse.json(
      { error: 'Failed to check leave conflicts' },
      { status: 500 }
    )
  }
}
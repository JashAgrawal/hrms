import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, eachDayOfInterval, format, getDay, startOfWeek, endOfWeek, isSameMonth, isToday } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || format(new Date(), 'yyyy-MM')
    const employeeId = searchParams.get('employeeId') || session.user.id

    // Parse month parameter
    const [year, monthNum] = month.split('-').map(Number)
    const currentDate = new Date(year, monthNum - 1, 1)

    // Get calendar date range (including partial weeks)
    const startDate = startOfWeek(startOfMonth(currentDate))
    const endDate = endOfWeek(endOfMonth(currentDate))
    const allDays = eachDayOfInterval({ start: startDate, end: endDate })

    // Get employee info
    const employee = await prisma.employee.findFirst({
      where: {
        userId: employeeId
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
      }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Get attendance records for the month
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: startDate,
          lte: endDate,
        }
      },
      select: {
        date: true,
        status: true,
        workHours: true,
        checkIn: true,
        checkOut: true,
      }
    })

    // Get leave requests for the month
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        OR: [
          {
            startDate: {
              gte: startDate,
              lte: endDate,
            }
          },
          {
            endDate: {
              gte: startDate,
              lte: endDate,
            }
          },
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: endDate } }
            ]
          }
        ],
        status: {
          in: ['PENDING', 'APPROVED']
        }
      },
      include: {
        policy: {
          select: {
            name: true,
            code: true,
            type: true,
          }
        }
      }
    })

    // Create attendance map
    const attendanceMap = new Map()
    attendanceRecords.forEach(record => {
      const dateKey = format(record.date, 'yyyy-MM-dd')
      attendanceMap.set(dateKey, record)
    })

    // Create leave map
    const leaveMap = new Map()
    leaveRequests.forEach(leave => {
      const leaveDays = eachDayOfInterval({
        start: new Date(leave.startDate),
        end: new Date(leave.endDate)
      })
      
      leaveDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd')
        if (day >= startDate && day <= endDate) {
          leaveMap.set(dateKey, leave)
        }
      })
    })

    // Build calendar days
    const calendarDays = allDays.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd')
      const dayOfWeek = getDay(date)
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const isCurrentMonth = isSameMonth(date, currentDate)
      
      const attendanceRecord = attendanceMap.get(dateKey)
      const leaveRecord = leaveMap.get(dateKey)
      
      let status = null
      let leaveType = null

      if (leaveRecord && leaveRecord.status === 'APPROVED') {
        status = 'LV'
        leaveType = leaveRecord.policy.type
      } else if (attendanceRecord) {
        switch (attendanceRecord.status) {
          case 'PRESENT':
            status = 'PP'
            break
          case 'ABSENT':
            status = 'AB'
            break
          case 'HALF_DAY':
            status = 'HD'
            break
          case 'WORK_FROM_HOME':
            status = 'PP' // Treat WFH as present
            break
          case 'ON_LEAVE':
            status = 'LV'
            break
          case 'HOLIDAY':
            status = 'WO'
            break
          default:
            status = isWeekend ? 'WO' : null
        }
      } else if (isWeekend) {
        status = 'WO'
      }

      return {
        date: date.toISOString(),
        dayOfWeek,
        isWeekend,
        status,
        leaveType,
        isToday: isToday(date),
        isCurrentMonth,
      }
    })

    // Get pending leave requests for the month
    const pendingRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: 'PENDING',
        startDate: {
          gte: startOfMonth(currentDate),
          lte: endOfMonth(currentDate),
        }
      },
      include: {
        policy: {
          select: {
            name: true,
            type: true,
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    })

    const formattedPendingRequests = pendingRequests.map(request => ({
      id: request.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      leaveType: request.policy.name,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
      days: Number(request.days),
      status: request.status,
    }))

    // Calculate summary
    const currentMonthDays = calendarDays.filter(day => day.isCurrentMonth)
    const summary = {
      totalDays: currentMonthDays.length,
      presentDays: currentMonthDays.filter(day => day.status === 'PP').length,
      absentDays: currentMonthDays.filter(day => day.status === 'AB').length,
      leaveDays: currentMonthDays.filter(day => day.status === 'LV').length,
      weekOffs: currentMonthDays.filter(day => day.status === 'WO').length,
    }

    return NextResponse.json({
      days: calendarDays,
      pendingRequests: formattedPendingRequests,
      summary,
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        code: employee.employeeCode,
      }
    })

  } catch (error) {
    console.error('Error fetching attendance calendar:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance calendar' },
      { status: 500 }
    )
  }
}
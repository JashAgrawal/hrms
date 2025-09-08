import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { eachDayOfInterval, isWeekend } from 'date-fns'

// GET /api/leave/availability - Get team availability data
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const departmentId = searchParams.get('departmentId')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Build department filter
    const departmentFilter: any = { isActive: true }
    if (departmentId) {
      departmentFilter.id = departmentId
    } else if (!['ADMIN', 'HR'].includes(currentUser.role)) {
      // Non-admin users can only see their department
      if (currentUser.employee?.departmentId) {
        departmentFilter.id = currentUser.employee.departmentId
      }
    }

    // Get departments with employees
    const departments = await prisma.department.findMany({
      where: departmentFilter,
      include: {
        employees: {
          where: { status: 'ACTIVE' },
          include: {
            leaveRequests: {
              where: {
                status: { in: ['APPROVED', 'PENDING'] },
                OR: [
                  {
                    AND: [
                      { startDate: { lte: end } },
                      { endDate: { gte: start } }
                    ]
                  }
                ]
              },
              include: {
                policy: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    type: true,
                  }
                }
              }
            }
          }
        }
      }
    })

    // Calculate availability for each department
    const departmentAvailability = departments.map(department => {
      const employees = department.employees.map(employee => {
        // Filter leaves that overlap with the date range
        const relevantLeaves = employee.leaveRequests.filter(leave => {
          const leaveStart = new Date(leave.startDate)
          const leaveEnd = new Date(leave.endDate)
          return leaveStart <= end && leaveEnd >= start
        })

        // Calculate working days in the period (excluding weekends)
        const allDays = eachDayOfInterval({ start, end })
        const workingDays = allDays.filter(day => !isWeekend(day))
        const totalWorkingDays = workingDays.length

        // Calculate leave days in the period
        let leaveDaysInPeriod = 0
        relevantLeaves.forEach(leave => {
          if (leave.status === 'APPROVED') {
            const leaveStart = new Date(Math.max(new Date(leave.startDate).getTime(), start.getTime()))
            const leaveEnd = new Date(Math.min(new Date(leave.endDate).getTime(), end.getTime()))
            
            const leaveDays = eachDayOfInterval({ start: leaveStart, end: leaveEnd })
              .filter(day => !isWeekend(day))
            
            if (leave.isHalfDay) {
              leaveDaysInPeriod += 0.5
            } else {
              leaveDaysInPeriod += leaveDays.length
            }
          }
        })

        // Check if employee is currently on leave
        const today = new Date()
        const isCurrentlyOnLeave = relevantLeaves.some(leave => {
          const leaveStart = new Date(leave.startDate)
          const leaveEnd = new Date(leave.endDate)
          return today >= leaveStart && today <= leaveEnd && leave.status === 'APPROVED'
        })

        const availabilityPercentage = totalWorkingDays > 0 ? 
          ((totalWorkingDays - leaveDaysInPeriod) / totalWorkingDays) * 100 : 100

        return {
          employee: {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeCode: employee.employeeCode,
            department: {
              id: department.id,
              name: department.name,
              code: department.code,
            }
          },
          leaves: relevantLeaves.map(leave => ({
            id: leave.id,
            startDate: leave.startDate,
            endDate: leave.endDate,
            status: leave.status,
            policy: leave.policy,
            isHalfDay: leave.isHalfDay,
            halfDayType: leave.halfDayType,
          })),
          availabilityPercentage: Math.max(0, availabilityPercentage),
          totalLeaveDays: leaveDaysInPeriod,
          isOnLeave: isCurrentlyOnLeave,
        }
      })

      // Calculate department-level statistics
      const totalEmployees = employees.length
      const availableEmployees = employees.filter(emp => !emp.isOnLeave).length
      const onLeaveEmployees = employees.filter(emp => emp.isOnLeave).length
      const departmentAvailabilityPercentage = totalEmployees > 0 ? 
        (availableEmployees / totalEmployees) * 100 : 100

      return {
        department: {
          id: department.id,
          name: department.name,
          code: department.code,
        },
        totalEmployees,
        availableEmployees,
        onLeaveEmployees,
        availabilityPercentage: departmentAvailabilityPercentage,
        employees: employees.sort((a, b) => 
          `${a.employee.firstName} ${a.employee.lastName}`.localeCompare(
            `${b.employee.firstName} ${b.employee.lastName}`
          )
        ),
      }
    })

    // Sort departments by availability (lowest first to highlight issues)
    departmentAvailability.sort((a, b) => a.availabilityPercentage - b.availabilityPercentage)

    return NextResponse.json({
      departments: departmentAvailability,
      summary: {
        totalDepartments: departmentAvailability.length,
        criticalDepartments: departmentAvailability.filter(d => d.availabilityPercentage < 60).length,
        totalEmployees: departmentAvailability.reduce((sum, d) => sum + d.totalEmployees, 0),
        totalAvailable: departmentAvailability.reduce((sum, d) => sum + d.availableEmployees, 0),
        totalOnLeave: departmentAvailability.reduce((sum, d) => sum + d.onLeaveEmployees, 0),
      }
    })
  } catch (error) {
    console.error('Error fetching availability data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability data' },
      { status: 500 }
    )
  }
}
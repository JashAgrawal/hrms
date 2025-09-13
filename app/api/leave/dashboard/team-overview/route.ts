import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Only managers, HR, and admins can see team overview
    if (!['MANAGER', 'HR', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const weekStart = startOfWeek(now)
    const weekEnd = endOfWeek(now)
    const next30Days = addDays(now, 30)

    // Build team member query based on user role
    let teamMemberCondition: any = {
      user: { isActive: true }
    }

    if (currentUser.role === 'MANAGER') {
      // Manager sees their direct reports and department members
      teamMemberCondition.OR = [
        { reportingTo: currentUser.employee.id }, // Direct reports
        { 
          departmentId: currentUser.employee.departmentId,
          reportingTo: null // Department members without direct manager
        }
      ]
    }
    // HR and ADMIN see all employees (no additional conditions)

    // Get team members
    const teamMembers = await prisma.employee.findMany({
      where: teamMemberCondition,
      include: {
        user: {
          select: {
            name: true,
            isActive: true
          }
        }
      }
    })

    const totalMembers = teamMembers.length

    // Get current leave requests for team members
    const currentLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
        employee: teamMemberCondition
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true
          }
        }
      }
    })

    // Get leaves for this week
    const weekLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: weekEnd },
        endDate: { gte: weekStart },
        employee: teamMemberCondition
      }
    })

    // Get upcoming leaves (next 30 days)
    const upcomingLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { 
          gt: now,
          lte: next30Days
        },
        employee: teamMemberCondition
      },
      include: {
        employee: {
          select: {
            id: true
          }
        }
      }
    })

    // Calculate stats
    const onLeaveToday = currentLeaves.length
    const onLeaveThisWeek = new Set(weekLeaves.map(leave => leave.employeeId)).size
    const availabilityPercentage = totalMembers > 0 
      ? Math.round(((totalMembers - onLeaveToday) / totalMembers) * 100)
      : 100
    const upcomingLeavesCount = upcomingLeaves.length

    // Check for critical coverage (less than 70% availability)
    const criticalCoverage = availabilityPercentage < 70

    // Get detailed member status
    const memberStatuses = await Promise.all(
      teamMembers.map(async (member) => {
        const user = {
          firstName: member.firstName,
          lastName: member.lastName
        }

        // Check if currently on leave
        const currentLeave = currentLeaves.find(leave => leave.employee.id === member.id)
        const isOnLeave = !!currentLeave

        // Get leave end date if on leave
        let leaveEndDate: string | undefined
        if (currentLeave) {
          leaveEndDate = currentLeave.endDate.toISOString()
        }

        // Count upcoming leaves for this member
        const memberUpcomingLeaves = upcomingLeaves.filter(
          leave => leave.employee.id === member.id
        ).length

        return {
          id: member.id,
          firstName: user.firstName,
          lastName: user.lastName,
          employeeCode: member.employeeCode,
          isOnLeave,
          leaveEndDate,
          upcomingLeaves: memberUpcomingLeaves
        }
      })
    )

    const stats = {
      totalMembers,
      onLeaveToday,
      onLeaveThisWeek,
      availabilityPercentage,
      upcomingLeaves: upcomingLeavesCount,
      criticalCoverage
    }

    return NextResponse.json({
      stats,
      members: memberStatuses
    })
  } catch (error) {
    console.error('Error fetching team overview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team overview' },
      { status: 500 }
    )
  }
}

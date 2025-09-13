import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'

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

    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)

    // Base query conditions based on user role
    const isEmployee = currentUser.role === 'EMPLOYEE'
    const isManager = ['MANAGER', 'HR', 'ADMIN'].includes(currentUser.role)
    
    let whereCondition: any = {}
    
    if (isEmployee) {
      // Employee sees only their own data
      whereCondition.employeeId = currentUser.employee.id
    } else if (currentUser.role === 'MANAGER') {
      // Manager sees their team's data
      whereCondition.OR = [
        { employeeId: currentUser.employee.id }, // Own requests
        { 
          employee: { 
            OR: [
              { reportingTo: currentUser.employee.id }, // Direct reports
              { departmentId: currentUser.employee.departmentId } // Same department
            ]
          } 
        }
      ]
    }
    // HR and ADMIN see all data (no additional conditions)

    // Get total requests this month
    const totalRequests = await prisma.leaveRequest.count({
      where: {
        ...whereCondition,
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    })

    // Get pending requests
    const pendingRequests = await prisma.leaveRequest.count({
      where: {
        ...whereCondition,
        status: 'PENDING'
      }
    })

    // Get approved requests this month
    const approvedRequests = await prisma.leaveRequest.count({
      where: {
        ...whereCondition,
        status: 'APPROVED',
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    })

    // Get rejected requests this month
    const rejectedRequests = await prisma.leaveRequest.count({
      where: {
        ...whereCondition,
        status: 'REJECTED',
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    })

    // Get employees on leave today
    const onLeaveToday = await prisma.leaveRequest.count({
      where: {
        ...whereCondition,
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart }
      }
    })

    // For employees, get their leave balance
    let myLeaveBalance = 0
    if (isEmployee) {
      const balances = await prisma.leaveBalance.findMany({
        where: {
          employeeId: currentUser.employee.id,
          year: now.getFullYear()
        }
      })
      myLeaveBalance = balances.reduce((sum, balance) => sum + Number(balance.available), 0)
    }

    // Get team availability percentage (for managers/HR)
    let teamAvailability = 100
    if (isManager) {
      let teamMemberCondition: any = {}
      
      if (currentUser.role === 'MANAGER') {
        teamMemberCondition = {
          OR: [
            { reportingTo: currentUser.employee.id },
            { departmentId: currentUser.employee.departmentId }
          ]
        }
      }

      const totalTeamMembers = await prisma.employee.count({
        where: {
          ...teamMemberCondition,
          user: { isActive: true }
        }
      })

      if (totalTeamMembers > 0) {
        const membersOnLeave = await prisma.leaveRequest.count({
          where: {
            status: 'APPROVED',
            startDate: { lte: todayEnd },
            endDate: { gte: todayStart },
            employee: teamMemberCondition
          }
        })

        teamAvailability = Math.round(((totalTeamMembers - membersOnLeave) / totalTeamMembers) * 100)
      }
    }

    // Get upcoming leaves (for employees)
    let upcomingLeaves = 0
    if (isEmployee) {
      upcomingLeaves = await prisma.leaveRequest.count({
        where: {
          employeeId: currentUser.employee.id,
          status: 'APPROVED',
          startDate: { gt: now }
        }
      })
    }

    const stats = {
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      onLeaveToday,
      teamAvailability,
      myLeaveBalance,
      upcomingLeaves
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}

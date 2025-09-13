import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'

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

    const isEmployee = currentUser.role === 'EMPLOYEE'
    const sevenDaysAgo = subDays(new Date(), 7)

    // Base query conditions based on user role
    let whereCondition: any = {
      updatedAt: { gte: sevenDaysAgo }
    }
    
    if (isEmployee) {
      // Employee sees only their own activities
      whereCondition.employeeId = currentUser.employee.id
    } else if (currentUser.role === 'MANAGER') {
      // Manager sees their team's activities
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
    // HR and ADMIN see all activities (no additional conditions)

    // Get recent leave requests with status changes
    const recentRequests = await prisma.leaveRequest.findMany({
      where: whereCondition,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            user: {
              select: {
                name: true
              }
            }
          }
        },
        policy: {
          select: {
            name: true,
            code: true
          }
        },
        approvals: {
          select: {
            id: true,
            approverId: true,
            level: true,
            status: true,
            approvedAt: true,
            rejectedAt: true,
            comments: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            updatedAt: 'desc'
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 20
    })

    // Transform requests into activity items
    const activities = []

    for (const request of recentRequests) {
      const user = {
        firstName: request.employee.firstName,
        lastName: request.employee.lastName
      }

      // Add request submission activity
      activities.push({
        id: `request-${request.id}-submitted`,
        type: 'REQUEST_SUBMITTED',
        title: isEmployee ? 'Leave request submitted' : `${user.firstName} ${user.lastName} submitted leave request`,
        description: `${request.policy.name} leave for ${Number(request.days)} day${Number(request.days) !== 1 ? 's' : ''}`,
        timestamp: request.createdAt.toISOString(),
        user: isEmployee ? undefined : user,
        leaveRequest: {
          id: request.id,
          policy: request.policy,
          startDate: request.startDate.toISOString(),
          endDate: request.endDate.toISOString(),
          days: request.days
        }
      })

      // Add approval/rejection activities
      for (const approval of request.approvals) {
        if (approval.status !== 'PENDING' && approval.updatedAt >= sevenDaysAgo) {
          const approverName = `Approver ${approval.approverId}`

          activities.push({
            id: `approval-${approval.id}-${approval.status.toLowerCase()}`,
            type: approval.status === 'APPROVED' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
            title: isEmployee 
              ? `Leave request ${approval.status.toLowerCase()}` 
              : `${approverName} ${approval.status.toLowerCase()} leave request`,
            description: `${request.policy.name} leave for ${user.firstName} ${user.lastName}`,
            timestamp: approval.updatedAt.toISOString(),
            user: isEmployee ? undefined : user,
            leaveRequest: {
              id: request.id,
              policy: request.policy,
              startDate: request.startDate.toISOString(),
              endDate: request.endDate.toISOString(),
              days: request.days
            }
          })
        }
      }

      // Add cancellation activity if applicable
      if (request.status === 'CANCELLED' && request.updatedAt >= sevenDaysAgo) {
        activities.push({
          id: `request-${request.id}-cancelled`,
          type: 'REQUEST_CANCELLED',
          title: isEmployee ? 'Leave request cancelled' : `${user.firstName} ${user.lastName} cancelled leave request`,
          description: `${request.policy.name} leave for ${Number(request.days)} day${Number(request.days) !== 1 ? 's' : ''}`,
          timestamp: request.updatedAt.toISOString(),
          user: isEmployee ? undefined : user,
          leaveRequest: {
            id: request.id,
            policy: request.policy,
            startDate: request.startDate.toISOString(),
            endDate: request.endDate.toISOString(),
            days: request.days
          }
        })
      }
    }

    // Sort activities by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      activities: activities.slice(0, 10) // Return top 10 activities
    })
  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent activity' },
      { status: 500 }
    )
  }
}

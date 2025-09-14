import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isBefore, addDays } from 'date-fns'

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

    // Only managers, HR, and admins can see pending approvals
    if (!['MANAGER', 'HR', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const now = new Date()

    // Build query conditions based on user role
    const whereCondition: any = {
      status: 'PENDING'
    }

    if (currentUser.role === 'MANAGER') {
      // Manager sees requests from their team that they can approve
      whereCondition.OR = [
        // Direct reports
        { 
          employee: { 
            reportingTo: currentUser.employee.id 
          }
        },
        // Same department members
        { 
          employee: { 
            departmentId: currentUser.employee.departmentId,
            reportingTo: null // Only if they don't have a direct manager
          }
        },
        // Requests where they are specifically assigned as an approver
        {
          approvals: {
            some: {
              approverId: currentUser.employee.id,
              status: 'PENDING'
            }
          }
        }
      ]
    }
    // HR and ADMIN see all pending requests (no additional conditions)

    const pendingRequests = await prisma.leaveRequest.findMany({
      where: whereCondition,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            reportingTo: true,
            departmentId: true
          }
        },
        policy: {
          select: {
            name: true,
            code: true
          }
        },
        approvals: {
          where: {
            status: 'PENDING'
          },
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
          }
        }
      },
      orderBy: [
        { startDate: 'asc' }, // Urgent requests first
        { createdAt: 'asc' }   // Then by submission time
      ]
    })

    // Filter requests that the current user can actually approve
    const approvableRequests = pendingRequests.filter(request => {
      // HR and ADMIN can approve all
      if (['HR', 'ADMIN'].includes(currentUser.role)) {
        return true
      }

      // For managers, check if they can approve this request
      if (currentUser.role === 'MANAGER' && currentUser.employee) {
        // Check if they are assigned as an approver
        const hasApprovalAssignment = request.approvals.some(
          approval => approval.approverId === currentUser.employee?.id
        )
        if (hasApprovalAssignment) {
          return true
        }
      }

      return false
    })

    // Transform to response format and add urgency flags
    const requests = approvableRequests.map(request => {
      const user = {
        firstName: request.employee.firstName,
        lastName: request.employee.lastName
      }

      // Check if request is urgent (starts within 3 days)
      const isUrgent = isBefore(request.startDate, addDays(now, 3))

      return {
        id: request.id,
        employee: {
          firstName: user.firstName,
          lastName: user.lastName,
          employeeCode: request.employee.employeeCode
        },
        policy: {
          name: request.policy.name,
          code: request.policy.code
        },
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        days: request.days,
        reason: request.reason,
        submittedAt: request.createdAt.toISOString(),
        isUrgent
      }
    })

    return NextResponse.json({
      requests,
      total: requests.length
    })
  } catch (error) {
    console.error('Error fetching pending approvals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending approvals' },
      { status: 500 }
    )
  }
}

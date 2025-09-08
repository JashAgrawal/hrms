import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LeaveService } from '@/lib/leave-service'
import { z } from 'zod'

// Validation schema for approval action
const approvalActionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional(),
})

// POST /api/leave/requests/[id]/approve - Approve or reject leave request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, comments } = approvalActionSchema.parse(body)

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Get leave request with approvals
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            reportingTo: true,
          }
        },
        policy: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            requiresApproval: true,
            approvalLevels: true,
          }
        },
        approvals: {
          orderBy: { level: 'asc' }
        }
      }
    })

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      )
    }

    // Check if request is in pending status
    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending requests can be approved or rejected' },
        { status: 400 }
      )
    }

    // Check if user has permission to approve
    const canApprove = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      (currentUser.employee && leaveRequest.employee.reportingTo === currentUser.employee.id) ||
      (currentUser.employee && leaveRequest.approvals.some(approval => 
        approval.approverId === currentUser.employee!.id && approval.status === 'PENDING'
      ))

    if (!canApprove) {
      return NextResponse.json(
        { error: 'You do not have permission to approve this request' },
        { status: 403 }
      )
    }

    // Find the current approval level for this user
    let currentApproval = currentUser.employee ? leaveRequest.approvals.find(
      approval => approval.approverId === currentUser.employee!.id && approval.status === 'PENDING'
    ) : undefined

    // If user is admin/HR, they can approve at any level
    if (['ADMIN', 'HR'].includes(currentUser.role) && !currentApproval) {
      // Find the next pending approval
      currentApproval = leaveRequest.approvals.find(approval => approval.status === 'PENDING')
    }

    if (!currentApproval) {
      return NextResponse.json(
        { error: 'No pending approval found for this user' },
        { status: 400 }
      )
    }

    // Update the approval record
    await prisma.leaveApproval.update({
      where: { id: currentApproval.id },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approvedAt: action === 'APPROVE' ? new Date() : null,
        rejectedAt: action === 'REJECT' ? new Date() : null,
        comments: comments || null,
        approverName: currentUser.employee ? 
          `${currentUser.employee.firstName} ${currentUser.employee.lastName}` : 
          currentUser.name || 'Unknown',
      }
    })

    // Log the approval action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: action === 'APPROVE' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
        resource: 'LEAVE_REQUEST',
        resourceId: id,
        newValues: {
          employeeName: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
          employeeCode: leaveRequest.employee.employeeCode,
          leaveType: leaveRequest.policy.name,
          startDate: leaveRequest.startDate.toISOString(),
          endDate: leaveRequest.endDate.toISOString(),
          days: Number(leaveRequest.days),
          action,
          comments: comments || null,
          approverName: currentUser.employee ? 
            `${currentUser.employee.firstName} ${currentUser.employee.lastName}` : 
            currentUser.name || 'Unknown',
        }
      }
    })

    let finalStatus: 'APPROVED' | 'REJECTED' | 'PENDING' = 'PENDING'

    if (action === 'REJECT') {
      // If rejected at any level, the entire request is rejected
      finalStatus = 'REJECTED'
      
      // Update leave request
      await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: comments || 'Rejected by approver'
        }
      })

      // Restore leave balance
      await LeaveService.updateBalanceForLeaveRequest(id, 'REJECTED')
    } else {
      // Check if all required approvals are complete
      const updatedApprovals = await prisma.leaveApproval.findMany({
        where: { leaveRequestId: id },
        orderBy: { level: 'asc' }
      })

      const allApproved = updatedApprovals.every(approval => approval.status === 'APPROVED')
      const hasRejection = updatedApprovals.some(approval => approval.status === 'REJECTED')

      if (hasRejection) {
        finalStatus = 'REJECTED'
      } else if (allApproved) {
        finalStatus = 'APPROVED'
        
        // Update leave request
        await prisma.leaveRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedBy: currentUser.employee!.id
          }
        })

        // Update leave balance (move from pending to used)
        await LeaveService.updateBalanceForLeaveRequest(id, 'APPROVED')
      }
      // If not all approved yet, status remains PENDING
    }

    // Get updated leave request
    const updatedRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          }
        },
        policy: {
          select: {
            name: true,
            code: true,
            type: true,
          }
        },
        approvals: {
          orderBy: { level: 'asc' }
        }
      }
    })

    return NextResponse.json({
      message: `Leave request ${action.toLowerCase()}d successfully`,
      request: updatedRequest,
      finalStatus
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing approval:', error)
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    )
  }
}

// GET /api/leave/requests/[id]/approve - Get approval details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
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

    // Get leave request with approvals
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            reportingTo: true,
          }
        },
        policy: {
          select: {
            name: true,
            code: true,
            type: true,
            requiresApproval: true,
            approvalLevels: true,
          }
        },
        approvals: {
          orderBy: { level: 'asc' }
        }
      }
    })

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      )
    }

    // Check if user can view approval details
    const canView = 
      (currentUser.employee && leaveRequest.employeeId === currentUser.employee.id) ||
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      (currentUser.employee && leaveRequest.employee.reportingTo === currentUser.employee.id) ||
      (currentUser.employee && leaveRequest.approvals.some(approval => approval.approverId === currentUser.employee!.id))

    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Determine if current user can approve
    const canApprove = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      (currentUser.employee && leaveRequest.employee.reportingTo === currentUser.employee.id) ||
      (currentUser.employee && leaveRequest.approvals.some(approval => 
        approval.approverId === currentUser.employee!.id && approval.status === 'PENDING'
      ))

    // Get current pending approval for this user
    const userPendingApproval = currentUser.employee ? leaveRequest.approvals.find(
      approval => approval.approverId === currentUser.employee!.id && approval.status === 'PENDING'
    ) : undefined

    return NextResponse.json({
      request: leaveRequest,
      canApprove: canApprove && leaveRequest.status === 'PENDING',
      userPendingApproval,
      approvalSummary: {
        totalLevels: leaveRequest.policy.approvalLevels,
        completedLevels: leaveRequest.approvals.filter(a => a.status !== 'PENDING').length,
        pendingLevels: leaveRequest.approvals.filter(a => a.status === 'PENDING').length,
        hasRejection: leaveRequest.approvals.some(a => a.status === 'REJECTED')
      }
    })
  } catch (error) {
    console.error('Error fetching approval details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approval details' },
      { status: 500 }
    )
  }
}
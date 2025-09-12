import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const approvalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional(),
})

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// POST /api/travel-requests/[id]/approve - Approve or reject travel request
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const body = await request.json()
    const { action, comments } = approvalSchema.parse(body)

    // Get travel request with approvals
    const travelRequest = await prisma.travelRequest.findUnique({
      where: { id },
      include: {
        approvals: {
          orderBy: { level: 'asc' },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!travelRequest) {
      return NextResponse.json({ error: 'Travel request not found' }, { status: 404 })
    }

    // Check if user has permission to approve
    const pendingApproval = travelRequest.approvals.find(
      approval => approval.approverId === user.employee?.id && approval.status === 'PENDING'
    )

    if (!pendingApproval && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No pending approval found for this user' }, { status: 403 })
    }

    // For admin users, find the next pending approval or create one
    let approvalToUpdate = pendingApproval
    if (!approvalToUpdate && user.role === 'ADMIN') {
      const nextPendingApproval = travelRequest.approvals.find(approval => approval.status === 'PENDING')
      if (nextPendingApproval) {
        approvalToUpdate = nextPendingApproval
      }
    }

    if (!approvalToUpdate) {
      return NextResponse.json({ error: 'No pending approvals found' }, { status: 400 })
    }

    // Update the approval
    const updatedApproval = await prisma.travelApproval.update({
      where: { id: approvalToUpdate.id },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        comments,
        approvedAt: action === 'APPROVE' ? new Date() : null,
        rejectedAt: action === 'REJECT' ? new Date() : null,
        approverName: `${user.employee.firstName} ${user.employee.lastName}`,
        approverEmail: user.email,
      },
    })

    // Check if this was a rejection or if all approvals are complete
    if (action === 'REJECT') {
      // Reject the entire travel request
      await prisma.travelRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: comments || 'Rejected by approver',
        },
      })

      // TODO: Send notification to employee about rejection
      
      return NextResponse.json({
        message: 'Travel request rejected successfully',
        approval: updatedApproval,
        travelRequestStatus: 'REJECTED',
      })
    }

    // Check if all required approvals are complete
    const allApprovals = await prisma.travelApproval.findMany({
      where: { travelRequestId: id },
      orderBy: { level: 'asc' },
    })

    const allApproved = allApprovals.every(approval => approval.status === 'APPROVED')
    const hasRejection = allApprovals.some(approval => approval.status === 'REJECTED')

    let newTravelRequestStatus = travelRequest.status

    if (hasRejection) {
      newTravelRequestStatus = 'REJECTED'
    } else if (allApproved) {
      newTravelRequestStatus = 'APPROVED'
    }

    // Update travel request status if needed
    if (newTravelRequestStatus !== travelRequest.status) {
      await prisma.travelRequest.update({
        where: { id },
        data: {
          status: newTravelRequestStatus,
          approvedAt: newTravelRequestStatus === 'APPROVED' ? new Date() : null,
          approvedBy: newTravelRequestStatus === 'APPROVED' ? user.employee.id : null,
        },
      })

      // TODO: Send notification to employee about approval/rejection
    }

    return NextResponse.json({
      message: `Travel request ${action.toLowerCase()}d successfully`,
      approval: updatedApproval,
      travelRequestStatus: newTravelRequestStatus,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing travel approval:', error)
    return NextResponse.json(
      { error: 'Failed to process travel approval' },
      { status: 500 }
    )
  }
}

// GET /api/travel-requests/[id]/approve - Get approval status
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const travelRequest = await prisma.travelRequest.findUnique({
      where: { id },
      include: {
        approvals: {
          orderBy: { level: 'asc' },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!travelRequest) {
      return NextResponse.json({ error: 'Travel request not found' }, { status: 404 })
    }

    // Check access permissions
    const canAccess =
      user.role === 'ADMIN' ||
      user.role === 'HR' ||
      travelRequest.employeeId === user.employee?.id ||
      travelRequest.approvals.some(approval => approval.approverId === user.employee?.id)

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({
      travelRequest: {
        id: travelRequest.id,
        title: travelRequest.title,
        status: travelRequest.status,
        employee: travelRequest.employee,
      },
      approvals: travelRequest.approvals,
      canApprove: travelRequest.approvals.some(
        approval => approval.approverId === user.employee?.id && approval.status === 'PENDING'
      ) || user.role === 'ADMIN',
    })
  } catch (error) {
    console.error('Error fetching travel approval status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch travel approval status' },
      { status: 500 }
    )
  }
}
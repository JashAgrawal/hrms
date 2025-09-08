import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LeaveService } from '@/lib/leave-service'
import { z } from 'zod'

// Validation schema for leave request updates
const updateLeaveRequestSchema = z.object({
  reason: z.string().min(1, 'Reason is required').optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    relationship: z.string().optional(),
  }).optional(),
  handoverNotes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
})

// GET /api/leave/requests/[id] - Get specific leave request
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

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
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

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Allow access if:
    // 1. User is the requester
    // 2. User is admin/HR
    // 3. User is a manager/approver
    const canAccess = 
      (currentUser.employee && leaveRequest.employeeId === currentUser.employee.id) ||
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      (currentUser.employee && leaveRequest.approvals.some(approval => approval.approverId === currentUser.employee!.id))

    if (!canAccess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    return NextResponse.json(leaveRequest)
  } catch (error) {
    console.error('Error fetching leave request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave request' },
      { status: 500 }
    )
  }
}

// PUT /api/leave/requests/[id] - Update leave request
export async function PUT(
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
    const validatedData = updateLeaveRequestSchema.parse(body)

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Get existing leave request
    const existingRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: true,
        policy: true,
      }
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      )
    }

    // Check permissions - only the requester can update their own request
    if (!currentUser.employee || existingRequest.employeeId !== currentUser.employee.id) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if request can be updated (only pending requests)
    if (existingRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending requests can be updated' },
        { status: 400 }
      )
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: validatedData,
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

    return NextResponse.json(updatedRequest)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating leave request:', error)
    return NextResponse.json(
      { error: 'Failed to update leave request' },
      { status: 500 }
    )
  }
}

// DELETE /api/leave/requests/[id] - Cancel leave request
export async function DELETE(
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
    const { cancellationReason } = body

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Get existing leave request
    const existingRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: true,
        policy: true,
      }
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      )
    }

    // Check permissions
    const canCancel = 
      (currentUser.employee && existingRequest.employeeId === currentUser.employee.id) ||
      ['ADMIN', 'HR'].includes(currentUser.role)

    if (!canCancel) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if request can be cancelled
    if (!['PENDING', 'APPROVED'].includes(existingRequest.status)) {
      return NextResponse.json(
        { error: 'Only pending or approved requests can be cancelled' },
        { status: 400 }
      )
    }

    // Check if cancellation is allowed (e.g., not too close to start date)
    const today = new Date()
    const startDate = new Date(existingRequest.startDate)
    const daysDifference = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDifference < 1 && currentUser.employee && existingRequest.employeeId === currentUser.employee.id) {
      return NextResponse.json(
        { error: 'Cannot cancel leave request on the same day or after it has started' },
        { status: 400 }
      )
    }

    // Update leave request status
    const cancelledRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: cancellationReason || 'Cancelled by user'
      },
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
        }
      }
    })

    // Update leave balance (restore the days)
    await LeaveService.updateBalanceForLeaveRequest(id, 'CANCELLED')

    return NextResponse.json({
      message: 'Leave request cancelled successfully',
      request: cancelledRequest
    })
  } catch (error) {
    console.error('Error cancelling leave request:', error)
    return NextResponse.json(
      { error: 'Failed to cancel leave request' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LeaveService } from '@/lib/leave-service'
import { z } from 'zod'
import { emailService } from '@/lib/email-service'

// Validation schema for leave request
const leaveRequestSchema = z.object({
  policyId: z.string().min(1, 'Leave policy is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
  emergencyContact: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    relationship: z.string().optional(),
  }).optional(),
  handoverNotes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  isHalfDay: z.boolean().default(false),
  halfDayType: z.enum(['FIRST_HALF', 'SECOND_HALF']).optional(),
})

// GET /api/leave/requests - Get leave requests
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    const policyId = searchParams.get('policyId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Build where clause
    const where: any = {}

    // If specific employee requested, check permissions
    if (employeeId) {
      if (!currentUser.employee || (employeeId !== currentUser.employee.id && !['ADMIN', 'HR', 'MANAGER'].includes(currentUser.role))) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      where.employeeId = employeeId
    } else if (['EMPLOYEE'].includes(currentUser.role)) {
      // Regular employees can only see their own requests
      if (currentUser.employee) {
        where.employeeId = currentUser.employee.id
      } else {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
      }
    }

    if (status) {
      where.status = status
    }

    if (policyId) {
      where.policyId = policyId
    }

    if (startDate || endDate) {
      where.startDate = {}
      if (startDate) {
        where.startDate.gte = new Date(startDate)
      }
      if (endDate) {
        where.startDate.lte = new Date(endDate)
      }
    }

    const [requests, totalCount] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
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
            select: {
              id: true,
              approverId: true,
              approverName: true,
              approverEmail: true,
              level: true,
              status: true,
              approvedAt: true,
              rejectedAt: true,
              comments: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: { level: 'asc' }
          }
        },
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leaveRequest.count({ where })
    ])

    return NextResponse.json({
      requests,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching leave requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave requests' },
      { status: 500 }
    )
  }
}

// POST /api/leave/requests - Create new leave request
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const validatedData = leaveRequestSchema.parse(body)

    const startDate = new Date(validatedData.startDate)
    const endDate = new Date(validatedData.endDate)

    // Validate dates
    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Start date cannot be after end date' },
        { status: 400 }
      )
    }

    // Get leave policy
    const policy = await prisma.leavePolicy.findUnique({
      where: { id: validatedData.policyId }
    })

    if (!policy || !policy.isActive) {
      return NextResponse.json(
        { error: 'Invalid or inactive leave policy' },
        { status: 400 }
      )
    }

    // Check minimum advance notice
    if (policy.minAdvanceNotice && policy.minAdvanceNotice > 0) {
      const today = new Date()
      const daysDifference = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysDifference < policy.minAdvanceNotice) {
        return NextResponse.json(
          { error: `Minimum ${policy.minAdvanceNotice} days advance notice required` },
          { status: 400 }
        )
      }
    }

    // Calculate leave days
    let leaveDays: number
    if (validatedData.isHalfDay) {
      leaveDays = 0.5
    } else {
      // Calculate business days between start and end date (inclusive)
      leaveDays = calculateBusinessDays(startDate, endDate)
    }

    // Check maximum consecutive days
    if (policy.maxConsecutiveDays && leaveDays > policy.maxConsecutiveDays) {
      return NextResponse.json(
        { error: `Maximum ${policy.maxConsecutiveDays} consecutive days allowed` },
        { status: 400 }
      )
    }

    // Check leave balance
    const balanceCheck = await LeaveService.checkLeaveBalance(
      currentUser.employee!.id,
      validatedData.policyId,
      leaveDays,
      startDate
    )

    if (!balanceCheck.hasBalance) {
      return NextResponse.json(
        { error: balanceCheck.message },
        { status: 400 }
      )
    }

    // Check for overlapping leave requests
    const overlappingRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: currentUser.employee!.id,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } }
            ]
          }
        ]
      }
    })

    if (overlappingRequests.length > 0) {
      return NextResponse.json(
        { error: 'You have overlapping leave requests for this period' },
        { status: 400 }
      )
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: currentUser.employee!.id,
        policyId: validatedData.policyId,
        startDate,
        endDate,
        days: leaveDays,
        reason: validatedData.reason,
        emergencyContact: validatedData.emergencyContact || undefined,
        handoverNotes: validatedData.handoverNotes,
        attachments: validatedData.attachments || undefined,
        isHalfDay: validatedData.isHalfDay,
        halfDayType: validatedData.halfDayType,
        status: policy.requiresApproval ? 'PENDING' : 'APPROVED',
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
            requiresApproval: true,
            approvalLevels: true,
          }
        }
      }
    })

    // Send email notifications
    try {
      const employeeEmail = currentUser.email || `${currentUser.employee!.employeeCode}@example.com`
      await emailService.sendEmail({
        to: employeeEmail,
        subject: `Leave request submitted (${policy.name})`,
        html: `<p>Hi ${currentUser.name || 'Employee'},</p><p>Your leave request for ${policy.name} from ${startDate.toDateString()} to ${endDate.toDateString()} has been submitted.</p>`,
      })
    } catch (e) {
      console.warn('Email send failed (leave submit):', e)
    }

    // Update leave balance (mark as pending)
    const year = startDate.getFullYear()
    await prisma.leaveBalance.updateMany({
      where: {
        employeeId: currentUser.employee!.id,
        policyId: validatedData.policyId,
        year
      },
      data: {
        pending: { increment: leaveDays },
        available: { decrement: leaveDays }
      }
    })

    // Create approval records if required
    if (policy.requiresApproval) {
      const approvals = []
      
      // For now, create a single approval level
      // In a more complex system, you would determine approvers based on hierarchy
      const approverId = currentUser.employee!.reportingTo || 'admin' // Fallback to admin
      
      // Get approver details to store the name
      let approverName = 'Admin'
      if (approverId !== 'admin' && currentUser.employee!.reportingTo) {
        const approver = await prisma.employee.findUnique({
          where: { id: currentUser.employee!.reportingTo },
          select: { firstName: true, lastName: true }
        })
        if (approver) {
          approverName = `${approver.firstName} ${approver.lastName}`
        }
      }
      
      approvals.push({
        leaveRequestId: leaveRequest.id,
        approverId,
        approverName,
        level: 1,
        status: 'PENDING' as const
      })

      await prisma.leaveApproval.createMany({
        data: approvals
      })

      // Notify manager/approver
      try {
        if (currentUser.employee?.reportingTo) {
          const approver = await prisma.employee.findUnique({
            where: { id: currentUser.employee.reportingTo },
            include: { user: true }
          })
          if (approver?.user?.email) {
            await emailService.sendEmail({
              to: approver.user.email,
              subject: 'New leave approval request',
              html: `<p>Hi ${approver.firstName},</p><p>You have a new leave request to review for ${currentUser.employee.firstName} ${currentUser.employee.lastName}.</p>`,
            })
          }
        }
      } catch (e) {
        console.warn('Email send failed (leave approver notify):', e)
      }
    } else {
      // Auto-approve if no approval required
      await LeaveService.updateBalanceForLeaveRequest(leaveRequest.id, 'APPROVED')
    }

    return NextResponse.json(leaveRequest, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating leave request:', error)
    return NextResponse.json(
      { error: 'Failed to create leave request' },
      { status: 500 }
    )
  }
}

// Helper function to calculate business days
function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0
  const current = new Date(startDate)
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  
  return count
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission } from '@/lib/permissions'

// Validation schema
const ApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional(),
  adjustments: z.array(z.object({
    entryId: z.string(),
    field: z.enum(['billableHours', 'nonBillableHours', 'overtimeHours', 'taskDescription']),
    oldValue: z.union([z.string(), z.number()]),
    newValue: z.union([z.string(), z.number()]),
    reason: z.string()
  })).optional()
})

// POST /api/timesheets/[id]/approve - Approve or reject timesheet
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const timesheetId = id
    const body = await request.json()
    const validatedData = ApprovalSchema.parse(body)
    const { action, comments, adjustments } = validatedData

    // Fetch timesheet with employee details
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            manager: { select: { id: true } },
            department: { select: { id: true, name: true } }
          }
        },
        entries: true
      }
    })

    if (!timesheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    // Check if timesheet is in submittable state
    if (timesheet.status !== 'SUBMITTED') {
      return NextResponse.json({ 
        error: 'Only submitted timesheets can be approved or rejected' 
      }, { status: 400 })
    }

    // Get current user details
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Check approval permissions
    const canApprove = await checkPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'APPROVE',
      resource: 'TEAM'
    }, { targetUserId: timesheet.employee.user?.id })

    if (!canApprove.allowed) {
      // Check if user is the direct manager
      const isDirectManager = timesheet.employee.reportingTo === currentUser.employee.id
      const isSameDepartmentManager = timesheet.employee.departmentId === currentUser.employee.departmentId && 
                                     ['MANAGER', 'HR', 'ADMIN'].includes(currentUser.role)

      if (!isDirectManager && !isSameDepartmentManager) {
        return NextResponse.json({ error: 'Insufficient permissions to approve this timesheet' }, { status: 403 })
      }
    }

    // Process approval in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Apply adjustments if provided
      if (adjustments && adjustments.length > 0) {
        for (const adjustment of adjustments) {
          const entry = await tx.timeEntry.findUnique({
            where: { id: adjustment.entryId }
          })

          if (!entry || entry.timesheetId !== timesheetId) {
            throw new Error(`Invalid entry ID: ${adjustment.entryId}`)
          }

          // Update the entry with adjustment
          await tx.timeEntry.update({
            where: { id: adjustment.entryId },
            data: {
              [adjustment.field]: adjustment.newValue
            }
          })

          // Log the adjustment
          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              action: 'TIMESHEET_ADJUSTMENT',
              resource: 'TIMESHEET',
              resourceId: timesheetId,
              details: {
                entryId: adjustment.entryId,
                field: adjustment.field,
                oldValue: adjustment.oldValue,
                newValue: adjustment.newValue,
                reason: adjustment.reason
              }
            }
          })
        }

        // Recalculate total hours after adjustments
        const updatedEntries = await tx.timeEntry.findMany({
          where: { timesheetId }
        })

        const newTotalHours = updatedEntries.reduce((sum, entry) => 
          sum + Number(entry.billableHours) + Number(entry.nonBillableHours) + Number(entry.overtimeHours), 0
        )

        await tx.timesheet.update({
          where: { id: timesheetId },
          data: { totalHours: newTotalHours }
        })
      }

      // Update timesheet status
      const updatedTimesheet = await tx.timesheet.update({
        where: { id: timesheetId },
        data: {
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          approvedBy: session.user.id,
          approvedAt: action === 'APPROVE' ? new Date() : null,
          rejectedAt: action === 'REJECT' ? new Date() : null,
          rejectionReason: action === 'REJECT' ? comments : null
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: { select: { email: true } }
            }
          },
          approver: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: action === 'APPROVE' ? 'TIMESHEET_APPROVED' : 'TIMESHEET_REJECTED',
          resource: 'TIMESHEET',
          resourceId: timesheetId,
          details: {
            employeeId: timesheet.employeeId,
            employeeName: `${timesheet.employee.firstName} ${timesheet.employee.lastName}`,
            period: `${timesheet.startDate.toISOString().split('T')[0]} to ${timesheet.endDate.toISOString().split('T')[0]}`,
            totalHours: updatedTimesheet.totalHours,
            comments,
            adjustmentsCount: adjustments?.length || 0
          }
        }
      })

      return updatedTimesheet
    })

    // TODO: Send notification to employee about approval/rejection
    // This would integrate with your notification system

    return NextResponse.json({
      message: `Timesheet ${action.toLowerCase()}d successfully`,
      timesheet: result
    })

  } catch (error) {
    console.error('Error processing timesheet approval:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 })
  }
}

// GET /api/timesheets/[id]/approve - Get approval details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const timesheetId = id

    // Fetch timesheet with approval history
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                user: { select: { name: true } }
              }
            }
          }
        },
        approver: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!timesheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    // Get approval history from audit logs
    const approvalHistory = await prisma.auditLog.findMany({
      where: {
        resource: 'TIMESHEET',
        resourceId: timesheetId,
        action: {
          in: ['TIMESHEET_APPROVED', 'TIMESHEET_REJECTED', 'TIMESHEET_ADJUSTMENT']
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    })

    // Check if current user can approve this timesheet
    const canApprove = await checkPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'APPROVE',
      resource: 'TEAM'
    }, { targetUserId: timesheet.employee.id })

    return NextResponse.json({
      timesheet,
      approvalHistory,
      canApprove: canApprove.allowed,
      isSubmitted: timesheet.status === 'SUBMITTED'
    })

  } catch (error) {
    console.error('Error fetching approval details:', error)
    return NextResponse.json({ error: 'Failed to fetch approval details' }, { status: 500 })
  }
}

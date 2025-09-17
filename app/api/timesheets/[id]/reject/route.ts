import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission } from '@/lib/permissions'

const RejectTimesheetSchema = z.object({
  comments: z.string().min(1, 'Comments are required for rejection')
})

// POST /api/timesheets/[id]/reject - Reject timesheet
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: timesheetId } = await params
    const body = await request.json()
    const validatedData = RejectTimesheetSchema.parse(body)

    // Check permissions
    const canReject = await checkPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'REJECT',
      resource: 'ALL'
    })

    if (!canReject.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if timesheet exists and is in submitted status
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true
          }
        }
      }
    })

    if (!timesheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    if (timesheet.status !== 'SUBMITTED') {
      return NextResponse.json({ 
        error: 'Only submitted timesheets can be rejected' 
      }, { status: 400 })
    }

    // Update timesheet status to rejected
    const updatedTimesheet = await prisma.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: validatedData.comments
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TIMESHEET_REJECTED',
        resource: 'TIMESHEET',
        resourceId: timesheetId,
        details: {
          employeeId: timesheet.employeeId,
          employeeName: `${timesheet.employee.firstName} ${timesheet.employee.lastName}`,
          employeeCode: timesheet.employee.employeeCode,
          period: `${timesheet.startDate} to ${timesheet.endDate}`,
          comments: validatedData.comments
        }
      }
    })

    return NextResponse.json({
      message: 'Timesheet rejected successfully',
      timesheet: updatedTimesheet
    })

  } catch (error) {
    console.error('Error rejecting timesheet:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to reject timesheet' }, { status: 500 })
  }
}
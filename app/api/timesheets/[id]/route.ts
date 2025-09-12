import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission } from '@/lib/permissions'

// Validation schemas
const UpdateTimesheetSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  entries: z.array(z.object({
    id: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    breakDuration: z.number().min(0).default(0),
    projectId: z.string().optional(),
    taskDescription: z.string().optional(),
    billableHours: z.number().min(0),
    nonBillableHours: z.number().min(0).default(0),
    overtimeHours: z.number().min(0).default(0),
  })).optional()
})

// GET /api/timesheets/[id] - Get specific timesheet
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

    // Fetch timesheet with all related data
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        },
        approver: {
          select: {
            id: true,
            name: true
          }
        },
        entries: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            breakDuration: true,
            taskDescription: true,
            billableHours: true,
            nonBillableHours: true,
            overtimeHours: true,
            project: {
              select: {
                id: true,
                name: true,
                code: true,
                clientName: true
              }
            }
          },
          orderBy: { date: 'asc' }
        }
      }
    })

    if (!timesheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    // Check permissions
    const canView = await checkPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'READ',
      resource: 'OWN'
    }, { targetUserId: timesheet.employee.id })

    if (!canView.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    return NextResponse.json({ timesheet })
  } catch (error) {
    console.error('Error fetching timesheet:', error)
    return NextResponse.json({ error: 'Failed to fetch timesheet' }, { status: 500 })
  }
}

// PUT /api/timesheets/[id] - Update timesheet
export async function PUT(
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
    const validatedData = UpdateTimesheetSchema.parse(body)

    // Fetch existing timesheet
    const existingTimesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: { entries: true }
    })

    if (!existingTimesheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    // Check permissions
    const canUpdate = await checkPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'UPDATE',
      resource: 'OWN'
    }, { targetUserId: existingTimesheet.employeeId })

    if (!canUpdate.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Prevent updates to approved timesheets unless user has admin permissions
    if (existingTimesheet.status === 'APPROVED') {
      const canUpdateApproved = await checkPermission(session.user.id, {
        module: 'TIMESHEET',
        action: 'UPDATE',
        resource: 'APPROVED'
      })

      if (!canUpdateApproved.allowed) {
        return NextResponse.json({ 
          error: 'Cannot update approved timesheet' 
        }, { status: 403 })
      }
    }

    // Update timesheet in transaction
    const updatedTimesheet = await prisma.$transaction(async (tx) => {
      let updateData: any = {}

      // Handle status updates
      if (validatedData.status) {
        updateData.status = validatedData.status
        
        if (validatedData.status === 'SUBMITTED') {
          updateData.submittedAt = new Date()
        }
      }

      // Handle entries updates
      if (validatedData.entries) {
        // Calculate new total hours
        const totalHours = validatedData.entries.reduce((sum, entry) => 
          sum + entry.billableHours + entry.nonBillableHours + entry.overtimeHours, 0
        )
        updateData.totalHours = totalHours

        // Delete existing entries and create new ones
        await tx.timeEntry.deleteMany({
          where: { timesheetId }
        })

        await Promise.all(
          validatedData.entries.map(entry =>
            tx.timeEntry.create({
              data: {
                timesheetId,
                employeeId: existingTimesheet.employeeId,
                date: new Date(entry.date),
                startTime: entry.startTime,
                endTime: entry.endTime,
                breakDuration: entry.breakDuration,
                projectId: entry.projectId,
                taskDescription: entry.taskDescription,
                billableHours: entry.billableHours,
                nonBillableHours: entry.nonBillableHours,
                overtimeHours: entry.overtimeHours
              }
            })
          )
        )
      }

      // Update the timesheet
      return await tx.timesheet.update({
        where: { id: timesheetId },
        data: updateData,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          entries: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            },
            orderBy: { date: 'asc' }
          }
        }
      })
    })

    return NextResponse.json({ 
      message: 'Timesheet updated successfully',
      timesheet: updatedTimesheet 
    })

  } catch (error) {
    console.error('Error updating timesheet:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update timesheet' }, { status: 500 })
  }
}

// DELETE /api/timesheets/[id] - Delete timesheet
export async function DELETE(
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

    // Fetch existing timesheet
    const existingTimesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId }
    })

    if (!existingTimesheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    // Check permissions
    const canDelete = await checkPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'DELETE',
      resource: 'OWN'
    }, { targetUserId: existingTimesheet.employeeId })

    if (!canDelete.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Prevent deletion of approved timesheets
    if (existingTimesheet.status === 'APPROVED') {
      return NextResponse.json({ 
        error: 'Cannot delete approved timesheet' 
      }, { status: 403 })
    }

    // Delete timesheet (entries will be cascade deleted)
    await prisma.timesheet.delete({
      where: { id: timesheetId }
    })

    return NextResponse.json({ 
      message: 'Timesheet deleted successfully' 
    })

  } catch (error) {
    console.error('Error deleting timesheet:', error)
    return NextResponse.json({ error: 'Failed to delete timesheet' }, { status: 500 })
  }
}

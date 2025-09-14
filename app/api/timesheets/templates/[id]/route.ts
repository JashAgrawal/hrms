import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { z } from 'zod'

const TemplateEntrySchema = z.object({
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  breakDuration: z.number().min(0).max(480),
  projectId: z.string().optional(),
  taskDescription: z.string().optional(),
  billableHours: z.number().min(0).max(24),
  nonBillableHours: z.number().min(0).max(24),
  overtimeHours: z.number().min(0).max(24),
  dayOfWeek: z.number().min(0).max(6)
})

const UpdateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  entries: z.array(TemplateEntrySchema)
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissionResult = await hasPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'READ',
      resource: 'OWN'
    })

    if (!permissionResult.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get employee ID from session
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const employeeId = user.employee.id

    const template = await prisma.timesheetTemplate.findFirst({
      where: {
        id,
        employeeId
      },
      include: {
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
          orderBy: {
            dayOfWeek: 'asc'
          }
        }
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Template GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissionResult = await hasPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'UPDATE',
      resource: 'OWN'
    })

    if (!permissionResult.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get employee ID from session
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const employeeId = user.employee.id
    const body = await request.json()

    // Validate request body
    const validation = UpdateTemplateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid template data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { name, description, isDefault, entries } = validation.data

    // Check if template exists and belongs to user
    const existingTemplate = await prisma.timesheetTemplate.findFirst({
      where: {
        id,
        employeeId
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check if name conflicts with another template
    const nameConflict = await prisma.timesheetTemplate.findFirst({
      where: {
        employeeId,
        name,
        id: { not: id }
      }
    })

    if (nameConflict) {
      return NextResponse.json(
        { error: 'Template with this name already exists' },
        { status: 409 }
      )
    }

    // If this is set as default, unset other default templates
    if (isDefault && !existingTemplate.isDefault) {
      await prisma.timesheetTemplate.updateMany({
        where: {
          employeeId,
          isDefault: true,
          id: { not: id }
        },
        data: {
          isDefault: false
        }
      })
    }

    // Update template with entries in a transaction
    const template = await prisma.$transaction(async (tx) => {
      // Update template
      const updatedTemplate = await tx.timesheetTemplate.update({
        where: { id },
        data: {
          name,
          description,
          isDefault
        }
      })

      // Delete existing entries
      await tx.timesheetTemplateEntry.deleteMany({
        where: { templateId: id }
      })

      // Create new entries
      if (entries.length > 0) {
        await tx.timesheetTemplateEntry.createMany({
          data: entries.map(entry => ({
            templateId: id,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            breakDuration: entry.breakDuration,
            projectId: entry.projectId,
            taskDescription: entry.taskDescription,
            billableHours: entry.billableHours,
            nonBillableHours: entry.nonBillableHours,
            overtimeHours: entry.overtimeHours
          }))
        })
      }

      return await tx.timesheetTemplate.findUnique({
        where: { id },
        include: {
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
            orderBy: {
              dayOfWeek: 'asc'
            }
          }
        }
      })
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Template PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissionResult = await hasPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'DELETE',
      resource: 'OWN'
    })

    if (!permissionResult.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get employee ID from session
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const employeeId = user.employee.id

    // Check if template exists and belongs to user
    const template = await prisma.timesheetTemplate.findFirst({
      where: {
        id,
        employeeId
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Delete template (entries will be deleted due to cascade)
    await prisma.timesheetTemplate.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Template deleted successfully' })
  } catch (error) {
    console.error('Template DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Apply template to a specific week
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissionResult = await hasPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'CREATE',
      resource: 'OWN'
    })

    if (!permissionResult.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get employee ID from session
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const employeeId = user.employee.id
    const body = await request.json()

    const { startDate } = body
    if (!startDate) {
      return NextResponse.json({ error: 'Start date is required' }, { status: 400 })
    }

    // Check if template exists and belongs to user
    const template = await prisma.timesheetTemplate.findFirst({
      where: {
        id,
        employeeId
      },
      include: {
        entries: true
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const weekStart = new Date(startDate)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    // Check if timesheet already exists for this week
    const existingTimesheet = await prisma.timesheet.findFirst({
      where: {
        employeeId,
        startDate: weekStart,
        endDate: weekEnd
      }
    })

    if (existingTimesheet) {
      return NextResponse.json(
        { error: 'Timesheet already exists for this week' },
        { status: 409 }
      )
    }

    // Create timesheet with entries from template
    const timesheet = await prisma.$transaction(async (tx) => {
      const newTimesheet = await tx.timesheet.create({
        data: {
          employeeId,
          startDate: weekStart,
          endDate: weekEnd,
          status: 'DRAFT'
        }
      })

      // Create time entries for each day based on template
      const timeEntries = []
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDate = new Date(weekStart)
        currentDate.setDate(weekStart.getDate() + dayOffset)
        const dayOfWeek = currentDate.getDay()

        const templateEntry = template.entries.find(entry => entry.dayOfWeek === dayOfWeek)
        if (templateEntry) {
          timeEntries.push({
            timesheetId: newTimesheet.id,
            employeeId,
            date: currentDate,
            startTime: templateEntry.startTime,
            endTime: templateEntry.endTime,
            breakDuration: templateEntry.breakDuration,
            projectId: templateEntry.projectId,
            taskDescription: templateEntry.taskDescription,
            billableHours: templateEntry.billableHours,
            nonBillableHours: templateEntry.nonBillableHours,
            overtimeHours: templateEntry.overtimeHours
          })
        }
      }

      if (timeEntries.length > 0) {
        await tx.timeEntry.createMany({
          data: timeEntries
        })
      }

      return await tx.timesheet.findUnique({
        where: { id: newTimesheet.id },
        include: {
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
            orderBy: {
              date: 'asc'
            }
          }
        }
      })
    })

    return NextResponse.json({ timesheet }, { status: 201 })
  } catch (error) {
    console.error('Template apply error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
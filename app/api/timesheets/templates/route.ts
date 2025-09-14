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

const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  entries: z.array(TemplateEntrySchema)
})

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const includeDefault = searchParams.get('includeDefault') === 'true'

    // Build query conditions
    const whereConditions: any = {
      employeeId
    }

    if (includeDefault) {
      whereConditions.OR = [
        { employeeId },
        { isDefault: true }
      ]
      delete whereConditions.employeeId
    }

    const templates = await prisma.timesheetTemplate.findMany({
      where: whereConditions,
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
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Templates GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    // Validate request body
    const validation = CreateTemplateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid template data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { name, description, isDefault, entries } = validation.data

    // Check if template name already exists for this employee
    const existingTemplate = await prisma.timesheetTemplate.findUnique({
      where: {
        employeeId_name: {
          employeeId,
          name
        }
      }
    })

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'Template with this name already exists' },
        { status: 409 }
      )
    }

    // If this is set as default, unset other default templates
    if (isDefault) {
      await prisma.timesheetTemplate.updateMany({
        where: {
          employeeId,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      })
    }

    // Create template with entries in a transaction
    const template = await prisma.$transaction(async (tx) => {
      const newTemplate = await tx.timesheetTemplate.create({
        data: {
          name,
          description,
          employeeId,
          isDefault
        }
      })

      if (entries.length > 0) {
        await tx.timesheetTemplateEntry.createMany({
          data: entries.map(entry => ({
            templateId: newTemplate.id,
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
        where: { id: newTemplate.id },
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

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Templates POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
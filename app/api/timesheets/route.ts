import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { withAuth } from '@/lib/api-middleware'
import { checkPermission } from '@/lib/permissions'

// Validation schemas
const TimesheetQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeId: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  projectId: z.string().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

const CreateTimesheetSchema = z.object({
  employeeId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    breakDuration: z.number().min(0).default(0),
    projectId: z.string().optional(),
    taskDescription: z.string().optional(),
    billableHours: z.number().min(0),
    nonBillableHours: z.number().min(0).default(0),
    overtimeHours: z.number().min(0).default(0),
  }))
})

// GET /api/timesheets - Fetch timesheets with advanced filtering
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    // Validate query parameters
    const validatedParams = TimesheetQuerySchema.parse(queryParams)
    const { startDate, endDate, employeeId: requestedEmployeeId, status, projectId, page = 1, limit = 50 } = validatedParams

    // Get current user with permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        employee: {
          include: {
            department: true,
            manager: true
          }
        }
      }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Determine employee scope based on permissions
    let employeeIds: string[] = [currentUser.employee.id]

    if (requestedEmployeeId) {
      // Check if user can view other employees' timesheets
      const canViewOthers = await checkPermission(session.user.id, {
        module: 'TIMESHEET',
        action: 'READ',
        resource: 'ALL'
      }, { targetUserId: requestedEmployeeId })

      if (canViewOthers.allowed) {
        employeeIds = [requestedEmployeeId]
      } else {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    } else if (['ADMIN', 'HR'].includes(currentUser.role)) {
      // Admin and HR can see all timesheets
      const allEmployees = await prisma.employee.findMany({ select: { id: true } })
      employeeIds = allEmployees.map(e => e.id)
    } else if (currentUser.role === 'MANAGER') {
      // Managers can see their team's timesheets
      const teamMembers = await prisma.employee.findMany({
        where: {
          OR: [
            { reportingTo: currentUser.employee.id },
            { departmentId: currentUser.employee.departmentId }
          ]
        },
        select: { id: true }
      })
      employeeIds = [currentUser.employee.id, ...teamMembers.map(e => e.id)]
    }

    // Build where clause
    const whereClause: any = {
      employeeId: { in: employeeIds },
      startDate: { gte: new Date(startDate) },
      endDate: { lte: new Date(endDate) }
    }

    if (status) {
      whereClause.status = status
    }

    // Fetch timesheets with pagination
    const [timesheets, totalCount] = await Promise.all([
      prisma.timesheet.findMany({
        where: whereClause,
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
            where: projectId ? { projectId } : undefined,
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
                  code: true
                }
              }
            },
            orderBy: { date: 'asc' }
          }
        },
        orderBy: [
          { startDate: 'desc' },
          { employee: { firstName: 'asc' } }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.timesheet.count({ where: whereClause })
    ])

    return NextResponse.json({
      timesheets,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching timesheets:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to fetch timesheets' }, { status: 500 })
  }
}

// POST /api/timesheets - Create new timesheet
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = CreateTimesheetSchema.parse(body)
    const { employeeId: requestedEmployeeId, startDate, endDate, entries } = validatedData

    // Get current user with permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Determine target employee
    let targetEmployeeId = currentUser.employee.id
    if (requestedEmployeeId) {
      const canCreateForOthers = await checkPermission(session.user.id, {
        module: 'TIMESHEET',
        action: 'CREATE',
        resource: 'ALL'
      }, { targetUserId: requestedEmployeeId })

      if (!canCreateForOthers.allowed) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      targetEmployeeId = requestedEmployeeId
    }

    // Validate date range
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start >= end) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    // Check for overlapping timesheets
    const existingTimesheet = await prisma.timesheet.findFirst({
      where: {
        employeeId: targetEmployeeId,
        OR: [
          {
            startDate: { lte: start },
            endDate: { gte: start }
          },
          {
            startDate: { lte: end },
            endDate: { gte: end }
          },
          {
            startDate: { gte: start },
            endDate: { lte: end }
          }
        ]
      }
    })

    if (existingTimesheet) {
      return NextResponse.json({
        error: 'Overlapping timesheet exists for this period'
      }, { status: 409 })
    }

    // Calculate total hours
    const totalHours = entries.reduce((sum, entry) =>
      sum + entry.billableHours + entry.nonBillableHours + entry.overtimeHours, 0
    )

    // Create timesheet with entries in a transaction
    const timesheet = await prisma.$transaction(async (tx) => {
      // Create the timesheet
      const newTimesheet = await tx.timesheet.create({
        data: {
          employeeId: targetEmployeeId,
          startDate: start,
          endDate: end,
          totalHours,
          status: 'DRAFT'
        }
      })

      // Create time entries
      const timeEntries = await Promise.all(
        entries.map(entry =>
          tx.timeEntry.create({
            data: {
              timesheetId: newTimesheet.id,
              employeeId: targetEmployeeId,
              date: new Date(entry.date),
              startTime: entry.startTime,
              endTime: entry.endTime,
              breakDuration: entry.breakDuration,
              projectId: entry.projectId || null, // Ensure null if not provided
              taskDescription: entry.taskDescription,
              billableHours: entry.billableHours,
              nonBillableHours: entry.nonBillableHours,
              overtimeHours: entry.overtimeHours
            }
          })
        )
      )

      return { ...newTimesheet, entries: timeEntries }
    })

    return NextResponse.json({
      message: 'Timesheet created successfully',
      timesheet
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating timesheet:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create timesheet' }, { status: 500 })
  }
}
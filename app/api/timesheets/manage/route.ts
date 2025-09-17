import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission } from '@/lib/permissions'

const TimesheetQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

// GET /api/timesheets/manage - Fetch timesheets for management
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    const validatedParams = TimesheetQuerySchema.parse(queryParams)
    const { status, search, page = 1, limit = 50 } = validatedParams

    // Check permissions - only managers, HR, and admins can manage timesheets
    const canManage = await checkPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'MANAGE',
      resource: 'ALL'
    })

    if (!canManage.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Build where clause
    const whereClause: any = {}

    if (status) {
      whereClause.status = status
    }

    if (search) {
      whereClause.OR = [
        {
          employee: {
            firstName: { contains: search, mode: 'insensitive' }
          }
        },
        {
          employee: {
            lastName: { contains: search, mode: 'insensitive' }
          }
        },
        {
          employee: {
            employeeCode: { contains: search, mode: 'insensitive' }
          }
        }
      ]
    }

    // Fetch timesheets with pagination
    const [timesheets, totalCount] = await Promise.all([
      prisma.timesheet.findMany({
        where: whereClause,
        orderBy: [
          { status: 'asc' },
          { submittedAt: 'desc' },
          { startDate: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              email: true
            }
          },
          entries: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  clientName: true
                }
              }
            }
          }
        }
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
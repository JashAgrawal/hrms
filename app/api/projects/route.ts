import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission } from '@/lib/permissions'

// Validation schemas
const ProjectQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  code: z.string().min(1, 'Project code is required'),
  description: z.string().optional(),
  clientName: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format').optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).default('ACTIVE'),
})

// GET /api/projects - Fetch projects
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    const validatedParams = ProjectQuerySchema.parse(queryParams)
    const { status, search, page = 1, limit = 50 } = validatedParams

    // Check permissions
    const canRead = await checkPermission(session.user.id, {
      module: 'PROJECT',
      action: 'READ',
      resource: 'ALL'
    })

    if (!canRead.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Build where clause
    const whereClause: any = {
      isActive: true
    }

    if (status) {
      whereClause.status = status
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Fetch projects with pagination
    const [projects, totalCount] = await Promise.all([
      prisma.project.findMany({
        where: whereClause,
        orderBy: [
          { status: 'asc' },
          { name: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              timeEntries: true
            }
          }
        }
      }),
      prisma.project.count({ where: whereClause })
    ])

    return NextResponse.json({
      projects,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching projects:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = CreateProjectSchema.parse(body)

    // Check permissions
    const canCreate = await checkPermission(session.user.id, {
      module: 'PROJECT',
      action: 'CREATE',
      resource: 'ALL'
    })

    if (!canCreate.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if project code already exists
    const existingProject = await prisma.project.findFirst({
      where: {
        OR: [
          { code: validatedData.code },
          { name: validatedData.name }
        ]
      }
    })

    if (existingProject) {
      return NextResponse.json({
        error: 'Project with this name or code already exists'
      }, { status: 409 })
    }

    // Validate dates
    const startDate = new Date(validatedData.startDate)
    const endDate = validatedData.endDate ? new Date(validatedData.endDate) : null

    if (endDate && startDate >= endDate) {
      return NextResponse.json({
        error: 'End date must be after start date'
      }, { status: 400 })
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        name: validatedData.name,
        code: validatedData.code,
        description: validatedData.description,
        clientName: validatedData.clientName,
        startDate,
        endDate,
        status: validatedData.status
      }
    })

    return NextResponse.json({
      message: 'Project created successfully',
      project
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating project:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
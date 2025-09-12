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
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  clientName: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).default('ACTIVE')
})

// GET /api/projects - Fetch projects with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    // Validate query parameters
    const validatedParams = ProjectQuerySchema.parse(queryParams)
    const { status, search, page = 1, limit = 50 } = validatedParams

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
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          clientName: true,
          startDate: true,
          endDate: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              timeEntries: true
            }
          }
        },
        orderBy: [
          { status: 'asc' },
          { name: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit
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

    // Check permissions
    const canCreate = await checkPermission(session.user.id, {
      module: 'PROJECT',
      action: 'CREATE',
      resource: 'ALL'
    })

    if (!canCreate.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = CreateProjectSchema.parse(body)

    // Check for duplicate project code
    const existingProject = await prisma.project.findUnique({
      where: { code: validatedData.code }
    })

    if (existingProject) {
      return NextResponse.json({ 
        error: 'Project code already exists' 
      }, { status: 409 })
    }

    // Validate date range
    if (validatedData.endDate) {
      const startDate = new Date(validatedData.startDate)
      const endDate = new Date(validatedData.endDate)
      
      if (startDate >= endDate) {
        return NextResponse.json({ 
          error: 'Start date must be before end date' 
        }, { status: 400 })
      }
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        name: validatedData.name,
        code: validatedData.code,
        description: validatedData.description,
        clientName: validatedData.clientName,
        startDate: new Date(validatedData.startDate),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        status: validatedData.status
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PROJECT_CREATED',
        resource: 'PROJECT',
        resourceId: project.id,
        details: {
          projectName: project.name,
          projectCode: project.code,
          clientName: project.clientName,
          status: project.status
        }
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

// PUT /api/projects - Update project (bulk update)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const canUpdate = await checkPermission(session.user.id, {
      module: 'PROJECT',
      action: 'UPDATE',
      resource: 'ALL'
    })

    if (!canUpdate.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { projectIds, updates } = body

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: 'Project IDs are required' }, { status: 400 })
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Updates are required' }, { status: 400 })
    }

    // Validate projects exist
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } }
    })

    if (projects.length !== projectIds.length) {
      return NextResponse.json({ error: 'Some projects not found' }, { status: 404 })
    }

    // Update projects
    const updatedProjects = await prisma.project.updateMany({
      where: { id: { in: projectIds } },
      data: updates
    })

    // Create audit logs
    await Promise.all(
      projects.map(project =>
        prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'PROJECT_BULK_UPDATED',
            resource: 'PROJECT',
            resourceId: project.id,
            details: {
              projectName: project.name,
              projectCode: project.code,
              updates,
              bulkOperation: true
            }
          }
        })
      )
    )

    return NextResponse.json({
      message: `${updatedProjects.count} projects updated successfully`,
      updatedCount: updatedProjects.count
    })

  } catch (error) {
    console.error('Error updating projects:', error)
    return NextResponse.json({ error: 'Failed to update projects' }, { status: 500 })
  }
}

// DELETE /api/projects - Soft delete projects
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const canDelete = await checkPermission(session.user.id, {
      module: 'PROJECT',
      action: 'DELETE',
      resource: 'ALL'
    })

    if (!canDelete.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const projectIds = searchParams.get('ids')?.split(',') || []

    if (projectIds.length === 0) {
      return NextResponse.json({ error: 'Project IDs are required' }, { status: 400 })
    }

    // Check if projects have associated time entries
    const projectsWithEntries = await prisma.project.findMany({
      where: { 
        id: { in: projectIds },
        timeEntries: { some: {} }
      },
      select: { id: true, name: true, code: true }
    })

    if (projectsWithEntries.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete projects with time entries',
        projectsWithEntries: projectsWithEntries.map(p => ({ id: p.id, name: p.name, code: p.code }))
      }, { status: 409 })
    }

    // Soft delete projects (set isActive to false)
    const deletedProjects = await prisma.project.updateMany({
      where: { id: { in: projectIds } },
      data: { isActive: false }
    })

    // Create audit logs
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } }
    })

    await Promise.all(
      projects.map(project =>
        prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'PROJECT_DELETED',
            resource: 'PROJECT',
            resourceId: project.id,
            details: {
              projectName: project.name,
              projectCode: project.code,
              softDelete: true
            }
          }
        })
      )
    )

    return NextResponse.json({
      message: `${deletedProjects.count} projects deleted successfully`,
      deletedCount: deletedProjects.count
    })

  } catch (error) {
    console.error('Error deleting projects:', error)
    return NextResponse.json({ error: 'Failed to delete projects' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission } from '@/lib/permissions'

const UpdateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  code: z.string().min(1, 'Project code is required'),
  description: z.string().optional(),
  clientName: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format').optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']),
})

// GET /api/projects/[id] - Get single project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Check permissions
    const canRead = await checkPermission(session.user.id, {
      module: 'PROJECT',
      action: 'READ',
      resource: 'ALL'
    })

    if (!canRead.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            timeEntries: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    const validatedData = UpdateProjectSchema.parse(body)

    // Check permissions
    const canUpdate = await checkPermission(session.user.id, {
      module: 'PROJECT',
      action: 'UPDATE',
      resource: 'ALL'
    })

    if (!canUpdate.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if project code/name already exists (excluding current project)
    const duplicateProject = await prisma.project.findFirst({
      where: {
        AND: [
          { id: { not: projectId } },
          {
            OR: [
              { code: validatedData.code },
              { name: validatedData.name }
            ]
          }
        ]
      }
    })

    if (duplicateProject) {
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

    // Update project
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
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
      message: 'Project updated successfully',
      project: updatedProject
    })

  } catch (error) {
    console.error('Error updating project:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Check permissions
    const canDelete = await checkPermission(session.user.id, {
      module: 'PROJECT',
      action: 'DELETE',
      resource: 'ALL'
    })

    if (!canDelete.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            timeEntries: true
          }
        }
      }
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Soft delete - mark as inactive instead of hard delete to preserve data integrity
    const deletedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        isActive: false,
        status: 'CANCELLED'
      }
    })

    return NextResponse.json({
      message: 'Project deleted successfully',
      project: deletedProject
    })

  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
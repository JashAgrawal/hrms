import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateObjectiveSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.enum(['INDIVIDUAL', 'TEAM', 'DEPARTMENT', 'COMPANY', 'PROJECT']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  weight: z.number().min(0).max(100).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ON_TRACK', 'AT_RISK', 'BEHIND', 'COMPLETED', 'CANCELLED']).optional(),
  progress: z.number().min(0).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  alignedTo: z.string().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/performance/objectives/[id] - Get a specific objective
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const objective = await prisma.objective.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
            department: {
              select: {
                name: true,
              }
            }
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            type: true,
            startDate: true,
            endDate: true,
          }
        },
        parent: {
          select: {
            id: true,
            title: true,
            category: true,
          }
        },
        children: {
          select: {
            id: true,
            title: true,
            status: true,
            progress: true,
          }
        },
        keyResults: {
          include: {
            updates: {
              orderBy: {
                updateDate: 'desc'
              },
              take: 3
            }
          }
        },
        updates: {
          orderBy: {
            updateDate: 'desc'
          },
          take: 5
        }
      }
    })

    if (!objective) {
      return NextResponse.json(
        { error: 'Objective not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(objective)
  } catch (error) {
    console.error('Error fetching objective:', error)
    return NextResponse.json(
      { error: 'Failed to fetch objective' },
      { status: 500 }
    )
  }
}

// PUT /api/performance/objectives/[id] - Update an objective
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateObjectiveSchema.parse(body)

    // Check if objective exists
    const existingObjective = await prisma.objective.findUnique({
      where: { id }
    })

    if (!existingObjective) {
      return NextResponse.json(
        { error: 'Objective not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      ...validatedData,
    }

    // Handle date conversion
    if (validatedData.startDate) {
      updateData.startDate = new Date(validatedData.startDate)
    }
    if (validatedData.endDate) {
      updateData.endDate = new Date(validatedData.endDate)
    }

    // Update the objective
    const updatedObjective = await prisma.objective.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
            department: {
              select: {
                name: true,
              }
            }
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            type: true,
          }
        },
        keyResults: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            progress: true,
            targetValue: true,
            currentValue: true,
            unit: true,
          }
        }
      }
    })

    return NextResponse.json(updatedObjective)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating objective:', error)
    return NextResponse.json(
      { error: 'Failed to update objective' },
      { status: 500 }
    )
  }
}

// DELETE /api/performance/objectives/[id] - Delete an objective
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if objective exists
    const existingObjective = await prisma.objective.findUnique({
      where: { id },
      include: {
        keyResults: true,
        children: true,
      }
    })

    if (!existingObjective) {
      return NextResponse.json(
        { error: 'Objective not found' },
        { status: 404 }
      )
    }

    // Only allow deletion of draft objectives or those without key results
    if (existingObjective.status !== 'DRAFT' && existingObjective.keyResults.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete active objectives with key results' },
        { status: 400 }
      )
    }

    // Check if objective has child objectives
    if (existingObjective.children.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete objective with child objectives' },
        { status: 400 }
      )
    }

    // Delete the objective (cascade will handle related records)
    await prisma.objective.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Objective deleted successfully' })
  } catch (error) {
    console.error('Error deleting objective:', error)
    return NextResponse.json(
      { error: 'Failed to delete objective' },
      { status: 500 }
    )
  }
}
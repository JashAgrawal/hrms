import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateCycleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(['QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'PROBATION', 'MID_YEAR', 'PROJECT_BASED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'CALIBRATION', 'COMPLETED', 'ARCHIVED']).optional(),
  isActive: z.boolean().optional(),
  template: z.any().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/performance/cycles/[id] - Get a specific performance cycle
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const cycle = await prisma.performanceCycle.findUnique({
      where: { id },
      include: {
        reviews: {
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
            }
          }
        },
        objectives: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
              }
            }
          }
        },
        _count: {
          select: {
            reviews: true,
            objectives: true,
          }
        }
      }
    })

    if (!cycle) {
      return NextResponse.json(
        { error: 'Performance cycle not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(cycle)
  } catch (error) {
    console.error('Error fetching performance cycle:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance cycle' },
      { status: 500 }
    )
  }
}

// PUT /api/performance/cycles/[id] - Update a performance cycle
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateCycleSchema.parse(body)

    // Check if cycle exists
    const existingCycle = await prisma.performanceCycle.findUnique({
      where: { id }
    })

    if (!existingCycle) {
      return NextResponse.json(
        { error: 'Performance cycle not found' },
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
    if (validatedData.dueDate) {
      updateData.dueDate = new Date(validatedData.dueDate)
    }

    // Validate dates if provided
    if (updateData.startDate && updateData.endDate) {
      if (updateData.startDate >= updateData.endDate) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        )
      }
    }

    if (updateData.endDate && updateData.dueDate) {
      if (updateData.dueDate <= updateData.endDate) {
        return NextResponse.json(
          { error: 'Due date must be after end date' },
          { status: 400 }
        )
      }
    }

    // Update the cycle
    const updatedCycle = await prisma.performanceCycle.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            reviews: true,
            objectives: true,
          }
        }
      }
    })

    return NextResponse.json(updatedCycle)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating performance cycle:', error)
    return NextResponse.json(
      { error: 'Failed to update performance cycle' },
      { status: 500 }
    )
  }
}

// DELETE /api/performance/cycles/[id] - Delete a performance cycle
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if cycle exists
    const existingCycle = await prisma.performanceCycle.findUnique({
      where: { id },
      include: {
        reviews: true,
        objectives: true,
      }
    })

    if (!existingCycle) {
      return NextResponse.json(
        { error: 'Performance cycle not found' },
        { status: 404 }
      )
    }

    // Only allow deletion of draft cycles or those without reviews
    if (existingCycle.status !== 'DRAFT' && existingCycle.reviews.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete active cycles with reviews' },
        { status: 400 }
      )
    }

    // Delete the cycle (cascade will handle related records)
    await prisma.performanceCycle.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Performance cycle deleted successfully' })
  } catch (error) {
    console.error('Error deleting performance cycle:', error)
    return NextResponse.json(
      { error: 'Failed to delete performance cycle' },
      { status: 500 }
    )
  }
}
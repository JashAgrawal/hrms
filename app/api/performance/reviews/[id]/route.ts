import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateReviewSchema = z.object({
  period: z.string().min(1).optional(),
  type: z.enum(['QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'PROBATION', 'MID_YEAR', 'PROJECT_BASED']).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'COMPLETED', 'CALIBRATED', 'PUBLISHED']).optional(),
  selfRating: z.any().optional(),
  managerRating: z.any().optional(),
  peerRating: z.any().optional(),
  subordinateRating: z.any().optional(),
  goals: z.any().optional(),
  achievements: z.any().optional(),
  developmentAreas: z.any().optional(),
  feedback: z.string().optional(),
  overallRating: z.number().min(1).max(5).optional(),
  calibrationRating: z.number().min(1).max(5).optional(),
  dueDate: z.string().datetime().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/performance/reviews/[id] - Get a specific performance review
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const review = await prisma.performanceReview.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
            email: true,
            department: {
              select: {
                name: true,
              }
            },
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
              }
            }
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            startDate: true,
            endDate: true,
            dueDate: true,
          }
        },
        objectives: {
          include: {
            keyResults: {
              include: {
                updates: {
                  orderBy: {
                    updateDate: 'desc'
                  },
                  take: 1
                }
              }
            },
            updates: {
              orderBy: {
                updateDate: 'desc'
              },
              take: 1
            }
          }
        },
        feedbacks: {
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
              }
            }
          }
        }
      }
    })

    if (!review) {
      return NextResponse.json(
        { error: 'Performance review not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(review)
  } catch (error) {
    console.error('Error fetching performance review:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance review' },
      { status: 500 }
    )
  }
}

// PUT /api/performance/reviews/[id] - Update a performance review
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateReviewSchema.parse(body)

    // Check if review exists
    const existingReview = await prisma.performanceReview.findUnique({
      where: { id },
      include: {
        employee: true,
      }
    })

    if (!existingReview) {
      return NextResponse.json(
        { error: 'Performance review not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      ...validatedData,
    }

    // Handle date conversion
    if (validatedData.dueDate) {
      updateData.dueDate = new Date(validatedData.dueDate)
    }

    // Handle status transitions
    if (validatedData.status) {
      if (validatedData.status === 'SUBMITTED' && !updateData.submittedAt) {
        updateData.submittedAt = new Date()
      }
      if (validatedData.status === 'COMPLETED' && !updateData.completedAt) {
        updateData.completedAt = new Date()
      }
      if (validatedData.status === 'CALIBRATED') {
        updateData.isCalibrated = true
        updateData.calibratedBy = session.user.id
        updateData.calibratedAt = new Date()
      }
    }

    // Update the review
    const updatedReview = await prisma.performanceReview.update({
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
        objectives: {
          select: {
            id: true,
            title: true,
            status: true,
            progress: true,
          }
        }
      }
    })

    return NextResponse.json(updatedReview)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating performance review:', error)
    return NextResponse.json(
      { error: 'Failed to update performance review' },
      { status: 500 }
    )
  }
}

// DELETE /api/performance/reviews/[id] - Delete a performance review
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if review exists
    const existingReview = await prisma.performanceReview.findUnique({
      where: { id },
    })

    if (!existingReview) {
      return NextResponse.json(
        { error: 'Performance review not found' },
        { status: 404 }
      )
    }

    // Only allow deletion of draft reviews
    if (existingReview.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Cannot delete submitted or completed reviews' },
        { status: 400 }
      )
    }

    // Delete the review (cascade will handle related records)
    await prisma.performanceReview.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Performance review deleted successfully' })
  } catch (error) {
    console.error('Error deleting performance review:', error)
    return NextResponse.json(
      { error: 'Failed to delete performance review' },
      { status: 500 }
    )
  }
}
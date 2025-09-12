import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateFeedbackSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'OVERDUE']).optional(),
  responses: z.record(z.any()).optional(),
  overallRating: z.number().min(1).max(5).optional(),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  comments: z.string().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/performance/feedback/[id] - Get a specific feedback
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const feedback = await prisma.feedback.findUnique({
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
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          }
        },
        review: {
          select: {
            id: true,
            period: true,
            type: true,
            status: true,
          }
        }
      }
    })

    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(feedback)
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}

// PUT /api/performance/feedback/[id] - Update feedback
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateFeedbackSchema.parse(body)

    // Check if feedback exists
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id }
    })

    if (!existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      ...validatedData,
    }

    // Handle status transitions
    if (validatedData.status === 'SUBMITTED' && !existingFeedback.submittedAt) {
      updateData.submittedAt = new Date()
    }

    // Update the feedback
    const updatedFeedback = await prisma.feedback.update({
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
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          }
        },
        review: {
          select: {
            id: true,
            period: true,
            type: true,
          }
        }
      }
    })

    return NextResponse.json(updatedFeedback)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating feedback:', error)
    return NextResponse.json(
      { error: 'Failed to update feedback' },
      { status: 500 }
    )
  }
}

// DELETE /api/performance/feedback/[id] - Delete feedback
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if feedback exists
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id }
    })

    if (!existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      )
    }

    // Only allow deletion of pending feedback
    if (existingFeedback.status === 'SUBMITTED') {
      return NextResponse.json(
        { error: 'Cannot delete submitted feedback' },
        { status: 400 }
      )
    }

    // Delete the feedback
    await prisma.feedback.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Feedback deleted successfully' })
  } catch (error) {
    console.error('Error deleting feedback:', error)
    return NextResponse.json(
      { error: 'Failed to delete feedback' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for creating feedback
const createFeedbackSchema = z.object({
  reviewId: z.string().cuid().optional(),
  employeeId: z.string().cuid(),
  reviewerId: z.string().cuid(),
  reviewerType: z.enum(['SELF', 'MANAGER', 'PEER', 'SUBORDINATE', 'EXTERNAL', 'SKIP_LEVEL']),
  relationship: z.string().optional(),
  isAnonymous: z.boolean().default(false),
  dueDate: z.string().datetime().optional(),
})

const updateFeedbackSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'OVERDUE']).optional(),
  responses: z.any().optional(),
  overallRating: z.number().min(1).max(5).optional(),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  comments: z.string().optional(),
})

// GET /api/performance/feedback - List feedback requests
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const reviewerId = searchParams.get('reviewerId')
    const reviewId = searchParams.get('reviewId')
    const status = searchParams.get('status')
    const reviewerType = searchParams.get('reviewerType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Build where clause based on filters
    const where: any = {}
    
    if (employeeId) {
      where.employeeId = employeeId
    }
    
    if (reviewerId) {
      where.reviewerId = reviewerId
    }
    
    if (reviewId) {
      where.reviewId = reviewId
    }
    
    if (status) {
      where.status = status
    }
    
    if (reviewerType) {
      where.reviewerType = reviewerType
    }

    // Get feedback with related data
    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
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
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.feedback.count({ where })
    ])

    return NextResponse.json({
      feedbacks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}

// POST /api/performance/feedback - Create a new feedback request
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createFeedbackSchema.parse(body)

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: validatedData.employeeId }
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Check if reviewer exists
    const reviewer = await prisma.employee.findUnique({
      where: { id: validatedData.reviewerId }
    })

    if (!reviewer) {
      return NextResponse.json(
        { error: 'Reviewer not found' },
        { status: 404 }
      )
    }

    // Check if feedback already exists for this combination
    const existingFeedback = await prisma.feedback.findFirst({
      where: {
        employeeId: validatedData.employeeId,
        reviewerId: validatedData.reviewerId,
        reviewId: validatedData.reviewId,
        reviewerType: validatedData.reviewerType,
      }
    })

    if (existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback request already exists for this combination' },
        { status: 409 }
      )
    }

    // Create the feedback request
    const feedback = await prisma.feedback.create({
      data: {
        ...validatedData,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
      },
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

    return NextResponse.json(feedback, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating feedback:', error)
    return NextResponse.json(
      { error: 'Failed to create feedback' },
      { status: 500 }
    )
  }
}
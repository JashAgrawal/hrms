import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for creating performance reviews
const createReviewSchema = z.object({
  employeeId: z.string().cuid(),
  cycleId: z.string().cuid().optional(),
  period: z.string().min(1),
  type: z.enum(['QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'PROBATION', 'MID_YEAR', 'PROJECT_BASED']).default('ANNUAL'),
  dueDate: z.string().datetime().optional(),
  goals: z.any().optional(),
  achievements: z.any().optional(),
  developmentAreas: z.any().optional(),
})

const updateReviewSchema = createReviewSchema.partial()

// GET /api/performance/reviews - List performance reviews
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const cycleId = searchParams.get('cycleId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Build where clause based on filters
    const where: any = {}
    
    if (employeeId) {
      where.employeeId = employeeId
    }
    
    if (cycleId) {
      where.cycleId = cycleId
    }
    
    if (status) {
      where.status = status
    }
    
    if (type) {
      where.type = type
    }

    // Get reviews with related data
    const [reviews, total] = await Promise.all([
      prisma.performanceReview.findMany({
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
          cycle: {
            select: {
              id: true,
              name: true,
              type: true,
              startDate: true,
              endDate: true,
            }
          },
          objectives: {
            select: {
              id: true,
              title: true,
              status: true,
              progress: true,
            }
          },
          _count: {
            select: {
              feedbacks: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.performanceReview.count({ where })
    ])

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching performance reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance reviews' },
      { status: 500 }
    )
  }
}

// POST /api/performance/reviews - Create a new performance review
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createReviewSchema.parse(body)

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: validatedData.employeeId },
      include: {
        department: true,
        manager: true,
      }
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Check if review already exists for this period
    const existingReview = await prisma.performanceReview.findFirst({
      where: {
        employeeId: validatedData.employeeId,
        period: validatedData.period,
        type: validatedData.type,
      }
    })

    if (existingReview) {
      return NextResponse.json(
        { error: 'Performance review already exists for this period' },
        { status: 409 }
      )
    }

    // Create the performance review
    const review = await prisma.performanceReview.create({
      data: {
        ...validatedData,
        reviewerId: employee.reportingTo || session.user.id,
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
        cycle: {
          select: {
            id: true,
            name: true,
            type: true,
          }
        }
      }
    })

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating performance review:', error)
    return NextResponse.json(
      { error: 'Failed to create performance review' },
      { status: 500 }
    )
  }
}
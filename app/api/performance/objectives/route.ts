import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for creating objectives
const createObjectiveSchema = z.object({
  employeeId: z.string().cuid(),
  reviewId: z.string().cuid().optional(),
  cycleId: z.string().cuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(['INDIVIDUAL', 'TEAM', 'DEPARTMENT', 'COMPANY', 'PROJECT']).default('INDIVIDUAL'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  weight: z.number().min(0).max(100).default(25),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  parentId: z.string().cuid().optional(),
  alignedTo: z.string().optional(),
})

const updateObjectiveSchema = createObjectiveSchema.partial().extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'ON_TRACK', 'AT_RISK', 'BEHIND', 'COMPLETED', 'CANCELLED']).optional(),
  progress: z.number().min(0).max(100).optional(),
})

// GET /api/performance/objectives - List objectives
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const cycleId = searchParams.get('cycleId')
    const reviewId = searchParams.get('reviewId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const parentId = searchParams.get('parentId')
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
    
    if (reviewId) {
      where.reviewId = reviewId
    }
    
    if (status) {
      where.status = status
    }
    
    if (category) {
      where.category = category
    }
    
    if (parentId) {
      where.parentId = parentId
    }

    // Get objectives with related data
    const [objectives, total] = await Promise.all([
      prisma.objective.findMany({
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
          },
          _count: {
            select: {
              updates: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.objective.count({ where })
    ])

    return NextResponse.json({
      objectives,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching objectives:', error)
    return NextResponse.json(
      { error: 'Failed to fetch objectives' },
      { status: 500 }
    )
  }
}

// POST /api/performance/objectives - Create a new objective
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createObjectiveSchema.parse(body)

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

    // Validate dates
    const startDate = new Date(validatedData.startDate)
    const endDate = new Date(validatedData.endDate)

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // If parent objective is specified, validate it exists and belongs to same employee
    if (validatedData.parentId) {
      const parentObjective = await prisma.objective.findUnique({
        where: { id: validatedData.parentId }
      })

      if (!parentObjective) {
        return NextResponse.json(
          { error: 'Parent objective not found' },
          { status: 404 }
        )
      }

      if (parentObjective.employeeId !== validatedData.employeeId) {
        return NextResponse.json(
          { error: 'Parent objective must belong to the same employee' },
          { status: 400 }
        )
      }
    }

    // Create the objective
    const objective = await prisma.objective.create({
      data: {
        ...validatedData,
        startDate,
        endDate,
        createdBy: session.user.id,
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
        },
        parent: {
          select: {
            id: true,
            title: true,
            category: true,
          }
        }
      }
    })

    return NextResponse.json(objective, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating objective:', error)
    return NextResponse.json(
      { error: 'Failed to create objective' },
      { status: 500 }
    )
  }
}
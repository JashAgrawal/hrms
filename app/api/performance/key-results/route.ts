import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for creating key results
const createKeyResultSchema = z.object({
  objectiveId: z.string().cuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['QUANTITATIVE', 'QUALITATIVE', 'MILESTONE', 'BINARY']).default('QUANTITATIVE'),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  targetDate: z.string().datetime().optional(),
  weight: z.number().min(0).max(100).default(25),
})

const updateKeyResultSchema = createKeyResultSchema.partial().extend({
  currentValue: z.number().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFERRED']).optional(),
  progress: z.number().min(0).max(100).optional(),
})

// GET /api/performance/key-results - List key results
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const objectiveId = searchParams.get('objectiveId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Build where clause based on filters
    const where: any = {}
    
    if (objectiveId) {
      where.objectiveId = objectiveId
    }
    
    if (status) {
      where.status = status
    }
    
    if (type) {
      where.type = type
    }

    // Get key results with related data
    const [keyResults, total] = await Promise.all([
      prisma.keyResult.findMany({
        where,
        include: {
          objective: {
            select: {
              id: true,
              title: true,
              category: true,
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
          updates: {
            orderBy: {
              updateDate: 'desc'
            },
            take: 5,
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
      prisma.keyResult.count({ where })
    ])

    return NextResponse.json({
      keyResults,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching key results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch key results' },
      { status: 500 }
    )
  }
}

// POST /api/performance/key-results - Create a new key result
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createKeyResultSchema.parse(body)

    // Check if objective exists
    const objective = await prisma.objective.findUnique({
      where: { id: validatedData.objectiveId }
    })

    if (!objective) {
      return NextResponse.json(
        { error: 'Objective not found' },
        { status: 404 }
      )
    }

    // Validate target date is within objective period
    if (validatedData.targetDate) {
      const targetDate = new Date(validatedData.targetDate)
      if (targetDate > objective.endDate) {
        return NextResponse.json(
          { error: 'Target date cannot be after objective end date' },
          { status: 400 }
        )
      }
    }

    // Create the key result
    const keyResult = await prisma.keyResult.create({
      data: {
        ...validatedData,
        targetDate: validatedData.targetDate ? new Date(validatedData.targetDate) : undefined,
        currentValue: 0, // Initialize current value to 0
      },
      include: {
        objective: {
          select: {
            id: true,
            title: true,
            category: true,
            employee: {
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

    return NextResponse.json(keyResult, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating key result:', error)
    return NextResponse.json(
      { error: 'Failed to create key result' },
      { status: 500 }
    )
  }
}
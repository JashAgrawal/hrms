import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for creating performance cycles
const createCycleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'PROBATION', 'MID_YEAR', 'PROJECT_BASED']).default('ANNUAL'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  template: z.any().optional(),
})

const updateCycleSchema = createCycleSchema.partial()

// GET /api/performance/cycles - List performance cycles
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Build where clause based on filters
    const where: any = {}
    
    if (status) {
      where.status = status
    }
    
    if (type) {
      where.type = type
    }
    
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // Get cycles with related data
    const [cycles, total] = await Promise.all([
      prisma.performanceCycle.findMany({
        where,
        include: {
          _count: {
            select: {
              reviews: true,
              objectives: true,
            }
          }
        },
        orderBy: {
          startDate: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.performanceCycle.count({ where })
    ])

    return NextResponse.json({
      cycles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching performance cycles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance cycles' },
      { status: 500 }
    )
  }
}

// POST /api/performance/cycles - Create a new performance cycle
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createCycleSchema.parse(body)

    // Check if cycle with same name already exists
    const existingCycle = await prisma.performanceCycle.findUnique({
      where: { name: validatedData.name }
    })

    if (existingCycle) {
      return NextResponse.json(
        { error: 'Performance cycle with this name already exists' },
        { status: 409 }
      )
    }

    // Validate dates
    const startDate = new Date(validatedData.startDate)
    const endDate = new Date(validatedData.endDate)
    const dueDate = new Date(validatedData.dueDate)

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    if (dueDate <= endDate) {
      return NextResponse.json(
        { error: 'Due date must be after end date' },
        { status: 400 }
      )
    }

    // Create the performance cycle
    const cycle = await prisma.performanceCycle.create({
      data: {
        ...validatedData,
        startDate,
        endDate,
        dueDate,
        createdBy: session.user.id,
      },
      include: {
        _count: {
          select: {
            reviews: true,
            objectives: true,
          }
        }
      }
    })

    return NextResponse.json(cycle, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating performance cycle:', error)
    return NextResponse.json(
      { error: 'Failed to create performance cycle' },
      { status: 500 }
    )
  }
}
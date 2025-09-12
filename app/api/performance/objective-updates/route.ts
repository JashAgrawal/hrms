import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for creating objective updates
const createUpdateSchema = z.object({
  objectiveId: z.string().cuid(),
  progress: z.number().min(0).max(100),
  comments: z.string().optional(),
  challenges: z.string().optional(),
  nextSteps: z.string().optional(),
  updateDate: z.string().datetime(),
})

// GET /api/performance/objective-updates - List objective updates
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const objectiveId = searchParams.get('objectiveId')
    const employeeId = searchParams.get('employeeId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Build where clause based on filters
    const where: any = {}
    
    if (objectiveId) {
      where.objectiveId = objectiveId
    }
    
    if (employeeId) {
      where.objective = {
        employeeId: employeeId
      }
    }

    // Get updates with related data
    const [updates, total] = await Promise.all([
      prisma.objectiveUpdate.findMany({
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
          }
        },
        orderBy: {
          updateDate: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.objectiveUpdate.count({ where })
    ])

    return NextResponse.json({
      updates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching objective updates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch objective updates' },
      { status: 500 }
    )
  }
}

// POST /api/performance/objective-updates - Create a new objective update
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createUpdateSchema.parse(body)

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

    // Create the objective update
    const update = await prisma.objectiveUpdate.create({
      data: {
        ...validatedData,
        updateDate: new Date(validatedData.updateDate),
        updatedBy: session.user.id,
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

    return NextResponse.json(update, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating objective update:', error)
    return NextResponse.json(
      { error: 'Failed to create objective update' },
      { status: 500 }
    )
  }
}
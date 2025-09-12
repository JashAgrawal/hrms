import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const createTravelRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  purpose: z.string().min(1, 'Purpose is required').max(500, 'Purpose too long'),
  destination: z.string().min(1, 'Destination is required'),
  fromLocation: z.string().min(1, 'From location is required'),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  estimatedCost: z.number().positive('Estimated cost must be positive'),
  travelMode: z.enum(['FLIGHT', 'TRAIN', 'BUS', 'CAR', 'TAXI', 'OTHER']).default('FLIGHT'),
  accommodationRequired: z.boolean().default(false),
  advanceRequired: z.boolean().default(false),
  advanceAmount: z.number().optional(),
  itinerary: z.array(z.object({
    date: z.string().transform((str) => new Date(str)),
    location: z.string(),
    activity: z.string(),
    estimatedCost: z.number().optional(),
    notes: z.string().optional(),
  })).optional(),
}).refine((data) => {
  return data.endDate >= data.startDate
}, {
  message: "End date must be after start date",
  path: ["endDate"],
}).refine((data) => {
  if (data.advanceRequired && !data.advanceAmount) {
    return false
  }
  return true
}, {
  message: "Advance amount is required when advance is requested",
  path: ["advanceAmount"],
})

// GET /api/travel-requests - List travel requests
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Build where clause based on user role and filters
    const whereClause: any = {}

    // Role-based filtering
    if (user.role === 'EMPLOYEE') {
      whereClause.employeeId = user.employee.id
    } else if (employeeId) {
      whereClause.employeeId = employeeId
    }

    // Additional filters
    if (status) {
      whereClause.status = status
    }
    if (startDate || endDate) {
      whereClause.startDate = {}
      if (startDate) whereClause.startDate.gte = new Date(startDate)
      if (endDate) whereClause.startDate.lte = new Date(endDate)
    }

    const [travelRequests, totalCount] = await Promise.all([
      prisma.travelRequest.findMany({
        where: whereClause,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
          approvals: {
            orderBy: { level: 'asc' },
          },
          expenseClaims: {
            select: {
              id: true,
              title: true,
              amount: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.travelRequest.count({ where: whereClause }),
    ])

    return NextResponse.json({
      data: travelRequests,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching travel requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch travel requests' },
      { status: 500 }
    )
  }
}

// POST /api/travel-requests - Create new travel request
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { 
        employee: {
          include: {
            department: true,
          }
        }
      },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = createTravelRequestSchema.parse(body)

    // Validate travel policy compliance
    const policyViolations = await validateTravelPolicy(validatedData, user.employee)

    // Create travel request
    const travelRequest = await prisma.travelRequest.create({
      data: {
        ...validatedData,
        employeeId: user.employee.id,
        status: policyViolations.length > 0 ? 'PENDING' : 'PENDING',
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        approvals: true,
      },
    })

    // Create approval workflow
    await createTravelApprovalWorkflow(travelRequest.id, user.employee)

    return NextResponse.json({
      ...travelRequest,
      policyViolations,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating travel request:', error)
    return NextResponse.json(
      { error: 'Failed to create travel request' },
      { status: 500 }
    )
  }
}

// Helper function to validate travel policy
async function validateTravelPolicy(data: any, employee: any): Promise<string[]> {
  const violations: string[] = []

  // Check advance amount limits (example: max 50% of estimated cost)
  if (data.advanceRequired && data.advanceAmount) {
    const maxAdvance = data.estimatedCost * 0.5
    if (data.advanceAmount > maxAdvance) {
      violations.push(`Advance amount cannot exceed 50% of estimated cost (₹${maxAdvance.toFixed(2)})`)
    }
  }

  // Check minimum advance notice (example: 3 days for domestic, 7 days for international)
  const daysDifference = Math.ceil((data.startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  const isInternational = !data.destination.toLowerCase().includes('india')
  const minDays = isInternational ? 7 : 3

  if (daysDifference < minDays) {
    violations.push(`Travel requests must be submitted at least ${minDays} days in advance`)
  }

  // Check cost limits based on employee grade/level
  const maxCostLimits = {
    'L1': 25000,
    'L2': 50000,
    'L3': 75000,
    'MANAGER': 100000,
    'SENIOR_MANAGER': 150000,
  }

  const employeeGrade = employee.salaryGrade || 'L1'
  const maxCost = maxCostLimits[employeeGrade as keyof typeof maxCostLimits] || 25000

  if (data.estimatedCost > maxCost) {
    violations.push(`Estimated cost exceeds limit for your grade (₹${maxCost.toFixed(2)})`)
  }

  return violations
}

// Helper function to create approval workflow
async function createTravelApprovalWorkflow(travelRequestId: string, employee: any) {
  const approvals = []

  // Level 1: Direct Manager (if exists)
  if (employee.reportingTo) {
    approvals.push({
      travelRequestId,
      approverId: employee.reportingTo,
      level: 1,
      status: 'PENDING' as const,
    })
  }

  // Level 2: Department Head (for high-value requests)
  // Add more approval levels based on business rules

  if (approvals.length > 0) {
    await prisma.travelApproval.createMany({
      data: approvals,
    })
  }
}
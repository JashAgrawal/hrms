import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const updateTravelRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  purpose: z.string().min(1, 'Purpose is required').max(500, 'Purpose too long').optional(),
  destination: z.string().min(1, 'Destination is required').optional(),
  fromLocation: z.string().min(1, 'From location is required').optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  estimatedCost: z.number().positive('Estimated cost must be positive').optional(),
  actualCost: z.number().positive('Actual cost must be positive').optional(),
  travelMode: z.enum(['FLIGHT', 'TRAIN', 'BUS', 'CAR', 'TAXI', 'OTHER']).optional(),
  accommodationRequired: z.boolean().optional(),
  advanceRequired: z.boolean().optional(),
  advanceAmount: z.number().optional(),
  itinerary: z.array(z.object({
    date: z.string().transform((str) => new Date(str)),
    location: z.string(),
    activity: z.string(),
    estimatedCost: z.number().optional(),
    notes: z.string().optional(),
  })).optional(),
})

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/travel-requests/[id] - Get travel request details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const travelRequest = await prisma.travelRequest.findUnique({
      where: { id: id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            reportingTo: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
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
            expenseDate: true,
          },
          orderBy: { expenseDate: 'desc' },
        },
      },
    })

    if (!travelRequest) {
      return NextResponse.json({ error: 'Travel request not found' }, { status: 404 })
    }

    // Check access permissions
    const canAccess = 
      user.role === 'ADMIN' ||
      user.role === 'HR' ||
      travelRequest.employeeId === user.employee.id ||
      (user.role === 'MANAGER' && user.employee?.id === travelRequest.employee.reportingTo)

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(travelRequest)
  } catch (error) {
    console.error('Error fetching travel request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch travel request' },
      { status: 500 }
    )
  }
}

// PUT /api/travel-requests/[id] - Update travel request
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const travelRequest = await prisma.travelRequest.findUnique({
      where: { id: id },
    })

    if (!travelRequest) {
      return NextResponse.json({ error: 'Travel request not found' }, { status: 404 })
    }

    // Check permissions - only owner can update pending requests
    if (travelRequest.employeeId !== user.employee.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if request can be updated
    if (travelRequest.status === 'APPROVED' || travelRequest.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot update approved or completed travel requests' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateTravelRequestSchema.parse(body)

    // Update travel request
    const updatedTravelRequest = await prisma.travelRequest.update({
      where: { id: id },
      data: {
        ...validatedData,
        updatedAt: new Date(),
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
    })

    return NextResponse.json(updatedTravelRequest)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating travel request:', error)
    return NextResponse.json(
      { error: 'Failed to update travel request' },
      { status: 500 }
    )
  }
}

// DELETE /api/travel-requests/[id] - Cancel travel request
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const travelRequest = await prisma.travelRequest.findUnique({
      where: { id: id },
    })

    if (!travelRequest) {
      return NextResponse.json({ error: 'Travel request not found' }, { status: 404 })
    }

    // Check permissions
    if (travelRequest.employeeId !== user.employee.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if request can be cancelled
    if (travelRequest.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot cancel completed travel requests' },
        { status: 400 }
      )
    }

    // Update status to cancelled instead of deleting
    const cancelledTravelRequest = await prisma.travelRequest.update({
      where: { id: id },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ 
      message: 'Travel request cancelled successfully',
      data: cancelledTravelRequest 
    })
  } catch (error) {
    console.error('Error cancelling travel request:', error)
    return NextResponse.json(
      { error: 'Failed to cancel travel request' },
      { status: 500 }
    )
  }
}
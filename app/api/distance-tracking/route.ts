import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DistanceTrackingService } from '@/lib/distance-tracking-service'
import { z } from 'zod'

const trackDistanceSchema = z.object({
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
  }),
  siteId: z.string().optional(),
  siteName: z.string().optional(),
})

const getDistanceRecordsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true, employeeType: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = trackDistanceSchema.parse(body)

    // Track the distance for this check-in
    const checkInPoint = await DistanceTrackingService.trackCheckInDistance(
      employee.id,
      validatedData.location,
      validatedData.siteId,
      validatedData.siteName
    )

    return NextResponse.json({
      checkInPoint,
      message: 'Distance tracked successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error tracking distance:', error)
    return NextResponse.json(
      { error: 'Failed to track distance' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const employeeId = searchParams.get('employeeId')

    // Validate query parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    const validatedParams = getDistanceRecordsSchema.parse({
      startDate,
      endDate,
      employeeId: employeeId || undefined,
    })

    // Determine which employee's records to fetch
    let targetEmployeeId = validatedParams.employeeId

    if (!targetEmployeeId) {
      // If no employeeId specified, get current user's employee record
      const employee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })

      if (!employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
      }

      targetEmployeeId = employee.id
    } else {
      // Check if user has permission to view other employee's data
      if (!['ADMIN', 'HR', 'MANAGER'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    const startDateObj = new Date(validatedParams.startDate)
    const endDateObj = new Date(validatedParams.endDate)

    const distanceRecords = await DistanceTrackingService.getDistanceRecords(
      targetEmployeeId,
      startDateObj,
      endDateObj
    )

    return NextResponse.json({
      distanceRecords,
      summary: {
        totalRecords: distanceRecords.length,
        totalDistance: distanceRecords.reduce((sum, record) => sum + record.totalDistance, 0),
        totalDuration: distanceRecords.reduce((sum, record) => sum + (record.totalDuration || 0), 0),
        recordsWithAnomalies: distanceRecords.filter(record => record.anomalies.length > 0).length,
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching distance records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch distance records' },
      { status: 500 }
    )
  }
}
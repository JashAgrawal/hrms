import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { DistanceTrackingService } from '@/lib/distance-tracking-service'

const createSiteVisitSchema = z.object({
  siteId: z.string().min(1, 'Site ID is required'),
  checkInLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional(),
    timestamp: z.string().optional(),
  }),
  purpose: z.string().optional(),
  notes: z.string().optional(),
})

const updateSiteVisitSchema = z.object({
  checkOutLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional(),
    timestamp: z.string().optional(),
  }),
  notes: z.string().optional(),
  photos: z.array(z.string()).optional(),
})

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const employeeId = searchParams.get('employeeId')
    const siteId = searchParams.get('siteId')
    const date = searchParams.get('date')
    const status = searchParams.get('status')

    const skip = (page - 1) * limit

    const where: any = {}

    // If not admin/hr, only show own visits
    if (!['ADMIN', 'HR'].includes(session.user.role)) {
      const employee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (employee) {
        where.employeeId = employee.id
      }
    } else if (employeeId) {
      where.employeeId = employeeId
    }

    if (siteId) {
      where.siteId = siteId
    }

    if (date) {
      const targetDate = new Date(date)
      where.date = {
        gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        lt: new Date(targetDate.setHours(23, 59, 59, 999)),
      }
    }

    if (status) {
      where.status = status
    }

    const [siteVisits, total] = await Promise.all([
      prisma.siteVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { checkInTime: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
          site: {
            select: {
              id: true,
              name: true,
              code: true,
              address: true,
              city: true,
              siteType: true,
            },
          },
        },
      }),
      prisma.siteVisit.count({ where }),
    ])

    return NextResponse.json({
      siteVisits,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching site visits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch site visits' },
      { status: 500 }
    )
  }
}

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

    if (employee.employeeType !== 'FIELD_EMPLOYEE') {
      return NextResponse.json(
        { error: 'Only field employees can create site visits' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createSiteVisitSchema.parse(body)

    // Check if site exists and employee is assigned to it
    const employeeSite = await prisma.employeeSite.findFirst({
      where: {
        employeeId: employee.id,
        siteId: validatedData.siteId,
        isActive: true,
      },
      include: {
        site: true,
      },
    })

    if (!employeeSite) {
      return NextResponse.json(
        { error: 'Site not found or not assigned to employee' },
        { status: 400 }
      )
    }

    // Check if employee already has an active visit to this site today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const existingVisit = await prisma.siteVisit.findFirst({
      where: {
        employeeId: employee.id,
        siteId: validatedData.siteId,
        date: {
          gte: today,
          lt: tomorrow,
        },
        status: 'IN_PROGRESS',
      },
    })

    if (existingVisit) {
      return NextResponse.json(
        { error: 'You already have an active visit to this site today' },
        { status: 400 }
      )
    }

    // Calculate distance from site
    const distance = calculateDistance(
      validatedData.checkInLocation.latitude,
      validatedData.checkInLocation.longitude,
      parseFloat(employeeSite.site.latitude.toString()),
      parseFloat(employeeSite.site.longitude.toString())
    )

    const isValidLocation = distance <= employeeSite.site.radius

    // Track distance for this check-in
    const checkInPoint = await DistanceTrackingService.trackCheckInDistance(
      employee.id,
      validatedData.checkInLocation,
      validatedData.siteId,
      employeeSite.site.name
    )

    // Create site visit
    const siteVisit = await prisma.siteVisit.create({
      data: {
        employeeId: employee.id,
        siteId: validatedData.siteId,
        date: new Date(),
        checkInTime: new Date(),
        checkInLocation: validatedData.checkInLocation,
        purpose: validatedData.purpose,
        notes: validatedData.notes,
        distanceFromSite: distance,
        isValidLocation,
        status: 'IN_PROGRESS',
      },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            city: true,
            siteType: true,
          },
        },
      },
    })

    return NextResponse.json({
      siteVisit,
      checkInPoint,
      message: isValidLocation
        ? 'Site visit started successfully'
        : 'Site visit started but location is outside the designated radius',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating site visit:', error)
    return NextResponse.json(
      { error: 'Failed to create site visit' },
      { status: 500 }
    )
  }
}
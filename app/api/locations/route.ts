import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LocationService } from '@/lib/location-service'
import { z } from 'zod'

// Schema for office location creation
const officeLocationSchema = z.object({
  name: z.string().min(1, 'Office name is required'),
  code: z.string().min(1, 'Office code is required').max(10),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(10).max(1000).default(100),
  timezone: z.string().default('Asia/Kolkata')
})

// GET /api/locations - Get all office locations
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get office locations with employee counts
    const officeLocations = await prisma.officeLocation.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            employeeLocations: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: [
        { isHeadOffice: 'desc' },
        { name: 'asc' }
      ]
    })

    const formattedLocations = officeLocations.map(office => ({
      id: office.id,
      name: office.name,
      code: office.code,
      address: office.address,
      city: office.city,
      state: office.state,
      latitude: Number(office.latitude),
      longitude: Number(office.longitude),
      radius: office.radius,
      timezone: office.timezone,
      isActive: office.isActive,
      createdAt: office.createdAt.toISOString(),
      updatedAt: office.updatedAt.toISOString(),
      _count: office._count
    }))

    return NextResponse.json({
      success: true,
      officeLocations: formattedLocations
    })

  } catch (error) {
    console.error('Error fetching office locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch office locations' },
      { status: 500 }
    )
  }
}

// POST /api/locations - Create new office location
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create office locations (Admin only)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = officeLocationSchema.parse(body)

    // Check if office code already exists
    const existingOffice = await prisma.officeLocation.findUnique({
      where: { code: data.code }
    })

    if (existingOffice) {
      return NextResponse.json(
        { error: 'Office code already exists' },
        { status: 400 }
      )
    }

    const officeLocation = await LocationService.createOfficeLocation({
      ...data,
      isActive: true
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_OFFICE_LOCATION',
        resource: 'OFFICE_LOCATION',
        resourceId: officeLocation.id,
        newValues: {
          name: data.name,
          code: data.code,
          city: data.city,
          state: data.state,
          coordinates: `${data.latitude}, ${data.longitude}`,
          radius: data.radius
        },
        ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
        userAgent: request.headers.get('user-agent')
      }
    })

    return NextResponse.json({
      success: true,
      officeLocation,
      message: 'Office location created successfully'
    })

  } catch (error) {
    console.error('Error creating office location:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create office location' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LocationService, GPSCoordinates } from '@/lib/location-service'
import { z } from 'zod'

// Schema for location validation request
const locationValidationSchema = z.object({
  employeeId: z.string().optional(),
  currentLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
    timestamp: z.string().datetime().optional()
  })
})

// POST /api/attendance/validate-location - Validate employee location
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = locationValidationSchema.parse(body)

    // Use provided employeeId or get from current user
    let employeeId = data.employeeId
    
    if (!employeeId) {
      // Get employee ID from current user
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { employee: true }
      })

      if (!user?.employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
      }

      employeeId = user.employee.id
    }

    // Convert timestamp string to Date if provided
    const currentLocation: GPSCoordinates = {
      ...data.currentLocation,
      timestamp: data.currentLocation.timestamp ? new Date(data.currentLocation.timestamp) : undefined
    }

    // Get location status using LocationService
    const locationStatus = await LocationService.getLocationStatus(
      employeeId,
      currentLocation
    )

    return NextResponse.json(locationStatus)

  } catch (error) {
    console.error('Error validating location:', error)
    
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
      { error: 'Failed to validate location' },
      { status: 500 }
    )
  }
}
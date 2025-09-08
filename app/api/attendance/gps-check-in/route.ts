import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema for GPS check-in request
const gpsCheckInSchema = z.object({
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
    address: z.string().optional(),
    timestamp: z.string().datetime().optional(),
  }),
  deviceInfo: z.object({
    platform: z.string(),
    userAgent: z.string().optional(),
    deviceId: z.string().optional(),
    appVersion: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
})

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c // Distance in meters
}

// POST /api/attendance/gps-check-in - GPS-based check-in with geo-fencing
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = gpsCheckInSchema.parse(body)

    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check if already checked in today
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: user.employee.id,
          date: today
        }
      },
      include: {
        checkInOut: {
          where: { type: 'CHECK_IN' },
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    })

    if (existingRecord && existingRecord.checkInOut.length > 0) {
      return NextResponse.json(
        { error: 'Already checked in today' },
        { status: 400 }
      )
    }

    // Get all active locations for geo-fencing validation
    const locations = await prisma.location.findMany({
      where: { isActive: true }
    })

    // Check if user is within any allowed location
    let isWithinGeofence = false
    let nearestLocation = null
    let minDistance = Infinity

    for (const location of locations) {
      const distance = calculateDistance(
        data.location.latitude,
        data.location.longitude,
        Number(location.latitude),
        Number(location.longitude)
      )

      if (distance < minDistance) {
        minDistance = distance
        nearestLocation = location
      }

      if (distance <= location.radius) {
        isWithinGeofence = true
        break
      }
    }

    const now = new Date()
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    // Determine attendance status
    let status = 'PRESENT'
    let requiresApproval = false

    // Check if location is valid
    if (!isWithinGeofence) {
      status = 'PRESENT' // Still mark as present but flag for review
      requiresApproval = true
    }

    // Check time-based status
    const workStartTime = new Date()
    workStartTime.setHours(9, 0, 0, 0) // 9:00 AM
    const graceTime = new Date()
    graceTime.setHours(9, 15, 0, 0) // 9:15 AM grace period

    if (now > graceTime) {
      status = 'LATE'
    }

    // Enhanced location data with geo-fencing info
    const locationData = {
      ...data.location,
      isWithinGeofence,
      nearestLocation: nearestLocation ? {
        id: nearestLocation.id,
        name: nearestLocation.name,
        distance: Math.round(minDistance)
      } : null,
      requiresApproval
    }

    // Create or update attendance record
    const attendanceRecord = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: user.employee.id,
          date: today
        }
      },
      update: {
        checkIn: now,
        status: status as any,
        method: 'GPS',
        location: locationData,
        notes: data.notes,
        updatedAt: now
      },
      create: {
        employeeId: user.employee.id,
        date: today,
        checkIn: now,
        status: status as any,
        method: 'GPS',
        location: locationData,
        notes: data.notes,
      }
    })

    // Create GPS check-in record
    const checkInRecord = await prisma.checkInOut.create({
      data: {
        attendanceId: attendanceRecord.id,
        employeeId: user.employee.id,
        type: 'CHECK_IN',
        timestamp: now,
        location: locationData,
        method: 'GPS',
        ipAddress: clientIP,
        deviceInfo: data.deviceInfo || {
          platform: 'mobile',
          userAgent: request.headers.get('user-agent')
        }
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'GPS_CHECK_IN',
        resource: 'ATTENDANCE',
        resourceId: attendanceRecord.id,
        newValues: {
          checkIn: now,
          status,
          method: 'GPS',
          location: locationData,
          isWithinGeofence,
          nearestLocationDistance: Math.round(minDistance)
        },
        ipAddress: clientIP,
        userAgent: request.headers.get('user-agent')
      }
    })

    // Prepare response message
    let message = `Successfully checked in at ${now.toLocaleTimeString()}`
    if (!isWithinGeofence) {
      message += ` (Location verification pending - ${Math.round(minDistance)}m from nearest office)`
    }

    return NextResponse.json({
      success: true,
      attendanceRecord: {
        ...attendanceRecord,
        checkInOut: [checkInRecord]
      },
      locationValidation: {
        isWithinGeofence,
        nearestLocation: nearestLocation ? {
          name: nearestLocation.name,
          distance: Math.round(minDistance)
        } : null,
        requiresApproval
      },
      message
    })

  } catch (error) {
    console.error('Error with GPS check-in:', error)
    return NextResponse.json(
      { error: 'Failed to process GPS check-in' },
      { status: 500 }
    )
  }
}
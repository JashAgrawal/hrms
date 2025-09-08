import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

// Schema for GPS check-out request
const gpsCheckOutSchema = z.object({
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

// POST /api/attendance/gps-check-out - GPS-based check-out with location tracking
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = gpsCheckOutSchema.parse(body)

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

    // Find today's attendance record
    const attendanceRecord = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: user.employee.id,
          date: today
        }
      },
      include: {
        checkInOut: {
          orderBy: { timestamp: 'desc' }
        }
      }
    })

    if (!attendanceRecord) {
      return NextResponse.json(
        { error: 'No check-in record found for today' },
        { status: 400 }
      )
    }

    if (attendanceRecord.checkOut) {
      return NextResponse.json(
        { error: 'Already checked out today' },
        { status: 400 }
      )
    }

    const now = new Date()
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

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

    // Calculate work hours
    const checkInTime = attendanceRecord.checkIn
    if (!checkInTime) {
      return NextResponse.json(
        { error: 'No check-in time found' },
        { status: 400 }
      )
    }

    const calculatedHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
    const workHours = new Decimal(calculatedHours)
    const standardWorkHours = 8
    const overtime = new Decimal(Math.max(0, calculatedHours - standardWorkHours))

    // Determine final status
    let finalStatus = attendanceRecord.status
    if (calculatedHours < 4) {
      finalStatus = 'HALF_DAY'
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
      requiresApproval: !isWithinGeofence
    }

    // Update attendance record
    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: attendanceRecord.id },
      data: {
        checkOut: now,
        workHours: workHours,
        overtime: overtime,
        status: finalStatus as any,
        location: {
          checkIn: attendanceRecord.location,
          checkOut: locationData
        },
        updatedAt: now
      }
    })

    // Create GPS check-out record
    const checkOutRecord = await prisma.checkInOut.create({
      data: {
        attendanceId: attendanceRecord.id,
        employeeId: user.employee.id,
        type: 'CHECK_OUT',
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
        action: 'GPS_CHECK_OUT',
        resource: 'ATTENDANCE',
        resourceId: attendanceRecord.id,
        oldValues: {
          checkOut: null,
          workHours: null,
          overtime: null
        },
        newValues: {
          checkOut: now,
          workHours: workHours.toNumber(),
          overtime: overtime.toNumber(),
          status: finalStatus,
          location: locationData,
          isWithinGeofence,
          nearestLocationDistance: Math.round(minDistance)
        },
        ipAddress: clientIP,
        userAgent: request.headers.get('user-agent')
      }
    })

    // Prepare response message
    let message = `Successfully checked out at ${now.toLocaleTimeString()}. Work hours: ${workHours.toNumber()}h`
    if (!isWithinGeofence) {
      message += ` (Location verification pending - ${Math.round(minDistance)}m from nearest office)`
    }

    return NextResponse.json({
      success: true,
      attendanceRecord: {
        ...updatedRecord,
        checkInOut: [...attendanceRecord.checkInOut, checkOutRecord]
      },
      workHours: workHours.toNumber(),
      overtime: overtime.toNumber(),
      locationValidation: {
        isWithinGeofence,
        nearestLocation: nearestLocation ? {
          name: nearestLocation.name,
          distance: Math.round(minDistance)
        } : null,
        requiresApproval: !isWithinGeofence
      },
      message
    })

  } catch (error) {
    console.error('Error with GPS check-out:', error)
    return NextResponse.json(
      { error: 'Failed to process GPS check-out' },
      { status: 500 }
    )
  }
}
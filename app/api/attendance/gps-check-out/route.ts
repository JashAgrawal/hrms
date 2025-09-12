import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LocationService } from '@/lib/location-service'
import { z } from 'zod'

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

// POST /api/attendance/gps-check-out - GPS-based check-out with location validation
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

    // Check if already checked out today
    const existingRecord = await prisma.attendanceRecord.findUnique({
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

    if (!existingRecord || !existingRecord.checkIn) {
      return NextResponse.json(
        { error: 'No check-in record found for today' },
        { status: 400 }
      )
    }

    // Check if already checked out
    const lastCheckOut = existingRecord.checkInOut.find(c => c.type === 'CHECK_OUT')
    if (lastCheckOut) {
      return NextResponse.json(
        { error: 'Already checked out today' },
        { status: 400 }
      )
    }

    // Validate employee location using LocationService
    const locationValidation = await LocationService.validateEmployeeLocation(
      user.employee.id,
      {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        accuracy: data.location.accuracy
      }
    )

    const now = new Date()
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    // Enhanced location data with validation info
    const locationData = JSON.parse(JSON.stringify({
      ...data.location,
      validation: {
        isValid: locationValidation.isValid,
        requiresApproval: locationValidation.requiresApproval,
        nearestLocation: locationValidation.nearestLocation,
        validLocations: locationValidation.validLocations
      }
    }))

    // Calculate work hours
    const checkInTime = existingRecord.checkIn
    const workHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60) // Convert to hours

    // Update attendance record with check-out
    const attendanceRecord = await prisma.attendanceRecord.update({
      where: { id: existingRecord.id },
      data: {
        checkOut: now,
        workHours: Math.round(workHours * 100) / 100, // Round to 2 decimal places
        notes: data.notes ? `${existingRecord.notes || ''}\nCheck-out: ${data.notes}`.trim() : existingRecord.notes,
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
        newValues: JSON.parse(JSON.stringify({
          checkOut: now,
          workHours: attendanceRecord.workHours,
          method: 'GPS',
          location: locationData,
          locationValidation: {
            isValid: locationValidation.isValid,
            requiresApproval: locationValidation.requiresApproval,
            nearestLocation: locationValidation.nearestLocation,
            validLocations: locationValidation.validLocations
          }
        })),
        ipAddress: clientIP,
        userAgent: request.headers.get('user-agent')
      }
    })

    // Prepare response message
    const workHoursFormatted = `${Math.floor(workHours)}h ${Math.floor((workHours % 1) * 60)}m`
    let message = `Successfully checked out at ${now.toLocaleTimeString()}`
    message += `. Total work hours: ${workHoursFormatted}`

    if (!locationValidation.isValid) {
      message += '. Note: Check-out location was outside assigned work areas.'
    }

    return NextResponse.json({
      success: true,
      attendanceRecord: {
        ...attendanceRecord,
        checkInOut: [...existingRecord.checkInOut, checkOutRecord]
      },
      locationValidation,
      workHours: attendanceRecord.workHours,
      message
    })

  } catch (error) {
    console.error('Error with GPS check-out:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process GPS check-out' },
      { status: 500 }
    )
  }
}
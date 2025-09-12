import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LocationService } from '@/lib/location-service'
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

    // Validate employee location using LocationService
    const locationValidation = await LocationService.validateEmployeeLocation(
      user.employee.id,
      {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        accuracy: data.location.accuracy
      }
    )

    // If no locations assigned, don't allow check-in
    if (locationValidation.validLocations.length === 0) {
      return NextResponse.json({
        error: 'No locations assigned. Please contact HR to assign work locations.',
        requiresLocationSetup: true
      }, { status: 400 })
    }

    const now = new Date()
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    // Determine attendance status
    let status = 'PRESENT'
    const requiresApproval = false

    // Check if location is valid - if not, create attendance request instead
    if (!locationValidation.isValid) {
      // Enhanced location data for attendance request
      const locationData = JSON.parse(JSON.stringify({
        ...data.location,
        validation: {
          isValid: locationValidation.isValid,
          requiresApproval: locationValidation.requiresApproval,
          nearestLocation: locationValidation.nearestLocation,
          validLocations: locationValidation.validLocations
        }
      }))

      // Create attendance request for manager/HR approval
      const attendanceRequest = await prisma.attendanceRequest.create({
        data: {
          employeeId: user.employee.id,
          date: today,
          checkInTime: now,
          location: locationData,
          reason: data.notes || 'Check-in from outside assigned location',
          status: 'PENDING'
        }
      })
      
      // Log the attendance request creation
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE_ATTENDANCE_REQUEST',
          resource: 'ATTENDANCE_REQUEST',
          resourceId: attendanceRequest.id,
          newValues: JSON.parse(JSON.stringify({
            reason: attendanceRequest.reason,
            location: locationData,
            nearestLocationDistance: locationValidation.nearestLocation?.distance,
            validLocations: locationValidation.validLocations
          })),
          ipAddress: clientIP,
          userAgent: request.headers.get('user-agent')
        }
      })
      
      return NextResponse.json({
        success: false,
        requiresApproval: true,
        attendanceRequest,
        message: `You are outside your assigned work location(s). An attendance request has been submitted for approval.${locationValidation.nearestLocation ? ` Distance to nearest assigned location: ${locationValidation.nearestLocation.distance}m` : ''}`,
        locationValidation
      })
    }

    // Check time-based status
    const workStartTime = new Date()
    workStartTime.setHours(9, 0, 0, 0) // 9:00 AM
    const graceTime = new Date()
    graceTime.setHours(9, 15, 0, 0) // 9:15 AM grace period

    if (now > graceTime) {
      status = 'LATE'
    }

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
        newValues: JSON.parse(JSON.stringify({
          checkIn: now,
          status,
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
    let message = `Successfully checked in at ${now.toLocaleTimeString()}`
    if (locationValidation.nearestLocation) {
      message += ` at ${locationValidation.nearestLocation.name}`
    }

    return NextResponse.json({
      success: true,
      attendanceRecord: {
        ...attendanceRecord,
        checkInOut: [checkInRecord]
      },
      locationValidation,
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
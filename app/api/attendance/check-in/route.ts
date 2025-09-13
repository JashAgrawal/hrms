import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LocationService } from '@/lib/location-service'
import { z } from 'zod'

// Schema for check-in request
const checkInSchema = z.object({
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
    address: z.string().optional(),
    timestamp: z.string().datetime().optional()
  }).optional(),
  method: z.enum(['WEB', 'MOBILE', 'GPS', 'BIOMETRIC']).optional(),
  notes: z.string().optional(),
  deviceInfo: z.object({
    platform: z.string().optional(),
    userAgent: z.string().optional(),
    deviceId: z.string().optional(),
    appVersion: z.string().optional()
  }).optional()
})

// POST /api/attendance/check-in - Check in for attendance
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = checkInSchema.parse(body)

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

    const now = new Date()
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    if (existingRecord && existingRecord.checkInOut.length > 0) {
      return NextResponse.json(
        { error: 'Already checked in today' },
        { status: 400 }
      )
    }

    // Determine method based on location availability
    let method = data.method || (data.location ? 'GPS' : 'WEB')
    let locationData = data.location
    let locationValidation = null

    // If location is provided, validate it for GPS-based checkin
    if (data.location && data.location.latitude && data.location.longitude) {
      try {
        locationValidation = await LocationService.validateEmployeeLocation(
          user.employee.id,
          {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            accuracy: data.location.accuracy,
            timestamp: data.location.timestamp ? new Date(data.location.timestamp) : new Date()
          }
        )

        // If location is not valid, create attendance request instead
        if (!locationValidation.isValid) {
          const attendanceRequest = await prisma.attendanceRequest.create({
            data: {
              employeeId: user.employee.id,
              date: today,
              checkInTime: now,
              location: {
                ...data.location,
                validation: JSON.parse(JSON.stringify(locationValidation))
              },
              reason: data.notes || 'Check-in from outside assigned location',
              status: 'PENDING'
            }
          })

          return NextResponse.json({
            success: false,
            requiresApproval: true,
            attendanceRequest,
            locationValidation,
            message: 'Check-in requires approval due to location. Request submitted for manager approval.'
          })
        }

        method = 'GPS'
        locationData = JSON.parse(JSON.stringify({
          ...data.location,
          validation: locationValidation
        }))
      } catch (error) {
        console.error('Location validation error:', error)
        // Continue with web-based checkin if location validation fails
        method = 'WEB'
        locationData = data.location
      }
    }

    // Determine attendance status based on time
    const workStartTime = new Date()
    workStartTime.setHours(9, 0, 0, 0) // 9:00 AM
    const graceTime = new Date()
    graceTime.setHours(9, 15, 0, 0) // 9:15 AM grace period

    let status = 'PRESENT'
    if (now > graceTime) {
      status = 'LATE'
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
        method: method as any,
        location: locationData,
        notes: data.notes,
        updatedAt: now
      },
      create: {
        employeeId: user.employee.id,
        date: today,
        checkIn: now,
        status: status as any,
        method: method as any,
        location: locationData,
        notes: data.notes,
      }
    })

    // Create check-in record
    const checkInRecord = await prisma.checkInOut.create({
      data: {
        attendanceId: attendanceRecord.id,
        employeeId: user.employee.id,
        type: 'CHECK_IN',
        timestamp: now,
        location: locationData,
        method: method as any,
        ipAddress: clientIP,
        deviceInfo: data.deviceInfo || {
          userAgent: request.headers.get('user-agent'),
          platform: method === 'GPS' ? 'mobile' : 'web'
        }
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CHECK_IN',
        resource: 'ATTENDANCE',
        resourceId: attendanceRecord.id,
        newValues: {
          checkIn: now,
          status,
          method: method,
          location: locationData
        },
        ipAddress: clientIP,
        userAgent: request.headers.get('user-agent')
      }
    })

    return NextResponse.json({
      success: true,
      attendanceRecord: {
        ...attendanceRecord,
        checkInOut: [checkInRecord]
      },
      locationValidation,
      method,
      message: `Successfully checked in at ${now.toLocaleTimeString()}${method === 'GPS' ? ' with GPS verification' : ''}`
    })

  } catch (error) {
    console.error('Error checking in:', error)
    return NextResponse.json(
      { error: 'Failed to check in' },
      { status: 500 }
    )
  }
}
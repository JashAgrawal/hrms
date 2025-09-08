import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema for check-in request
const checkInSchema = z.object({
  location: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    accuracy: z.number().optional(),
    address: z.string().optional(),
  }).optional(),
  method: z.enum(['WEB', 'MOBILE', 'GPS', 'BIOMETRIC']).default('WEB'),
  notes: z.string().optional(),
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
        method: data.method as any,
        location: data.location,
        notes: data.notes,
        updatedAt: now
      },
      create: {
        employeeId: user.employee.id,
        date: today,
        checkIn: now,
        status: status as any,
        method: data.method as any,
        location: data.location,
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
        location: data.location,
        method: data.method as any,
        ipAddress: clientIP,
        deviceInfo: {
          userAgent: request.headers.get('user-agent'),
          platform: 'web'
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
          method: data.method,
          location: data.location
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
      message: `Successfully checked in at ${now.toLocaleTimeString()}`
    })

  } catch (error) {
    console.error('Error checking in:', error)
    return NextResponse.json(
      { error: 'Failed to check in' },
      { status: 500 }
    )
  }
}
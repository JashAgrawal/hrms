import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

// Schema for check-out request
const checkOutSchema = z.object({
  location: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    accuracy: z.number().optional(),
    address: z.string().optional(),
  }).optional(),
  method: z.enum(['WEB', 'MOBILE', 'GPS', 'BIOMETRIC']).default('WEB'),
  notes: z.string().optional(),
})

// POST /api/attendance/check-out - Check out for attendance
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = checkOutSchema.parse(body)

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

    // Update attendance record
    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: attendanceRecord.id },
      data: {
        checkOut: now,
        workHours: workHours,
        overtime: overtime,
        status: finalStatus as any,
        updatedAt: now
      }
    })

    // Create check-out record
    const checkOutRecord = await prisma.checkInOut.create({
      data: {
        attendanceId: attendanceRecord.id,
        employeeId: user.employee.id,
        type: 'CHECK_OUT',
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
        action: 'CHECK_OUT',
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
          status: finalStatus
        },
        ipAddress: clientIP,
        userAgent: request.headers.get('user-agent')
      }
    })

    return NextResponse.json({
      success: true,
      attendanceRecord: {
        ...updatedRecord,
        checkInOut: [...attendanceRecord.checkInOut, checkOutRecord]
      },
      workHours: workHours.toNumber(),
      overtime: overtime.toNumber(),
      message: `Successfully checked out at ${now.toLocaleTimeString()}. Work hours: ${workHours.toNumber()}h`
    })

  } catch (error) {
    console.error('Error checking out:', error)
    return NextResponse.json(
      { error: 'Failed to check out' },
      { status: 500 }
    )
  }
}
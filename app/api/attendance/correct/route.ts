import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

// Schema for attendance correction
const correctionSchema = z.object({
  attendanceId: z.string(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME', 'ON_LEAVE', 'HOLIDAY']),
  reason: z.string().min(1, 'Reason is required for manual corrections'),
  notes: z.string().optional(),
})

// POST /api/attendance/correct - Manual attendance correction by managers
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = correctionSchema.parse(body)

    // Get user's employee record and check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Check if user has permission to correct attendance (HR or Manager)
    if (!['HR', 'ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get the attendance record to be corrected
    const attendanceRecord = await prisma.attendanceRecord.findUnique({
      where: { id: data.attendanceId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            reportingTo: true
          }
        }
      }
    })

    if (!attendanceRecord) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    // For managers, check if they can correct this employee's attendance
    if (user.role === 'MANAGER') {
      if (attendanceRecord.employee.reportingTo !== user.employee.id) {
        return NextResponse.json({ error: 'Can only correct attendance for direct reports' }, { status: 403 })
      }
    }

    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    // Store original values for audit
    const originalValues = {
      checkIn: attendanceRecord.checkIn,
      checkOut: attendanceRecord.checkOut,
      status: attendanceRecord.status,
      workHours: attendanceRecord.workHours,
      overtime: attendanceRecord.overtime
    }

    // Calculate work hours if both check-in and check-out are provided
    let workHours = attendanceRecord.workHours
    let overtime = attendanceRecord.overtime

    if (data.checkIn && data.checkOut) {
      const checkInTime = new Date(data.checkIn)
      const checkOutTime = new Date(data.checkOut)
      const calculatedHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
      workHours = new Decimal(calculatedHours)
      const standardWorkHours = 8
      overtime = new Decimal(Math.max(0, calculatedHours - standardWorkHours))
    }

    // Update attendance record
    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: data.attendanceId },
      data: {
        checkIn: data.checkIn ? new Date(data.checkIn) : attendanceRecord.checkIn,
        checkOut: data.checkOut ? new Date(data.checkOut) : attendanceRecord.checkOut,
        status: data.status as any,
        workHours: workHours || attendanceRecord.workHours,
        overtime: overtime || attendanceRecord.overtime,
        notes: data.notes || attendanceRecord.notes,
        approvedBy: user.employee.id,
        approvedAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Create manual check-in/out records if times were corrected
    const checkInOutRecords = []
    
    if (data.checkIn) {
      const checkInRecord = await prisma.checkInOut.create({
        data: {
          attendanceId: data.attendanceId,
          employeeId: attendanceRecord.employeeId,
          type: 'CHECK_IN',
          timestamp: new Date(data.checkIn),
          method: 'WEB',
          ipAddress: clientIP,
          isManualEntry: true,
          manualReason: data.reason,
          approvedBy: user.employee.id,
          deviceInfo: {
            userAgent: request.headers.get('user-agent'),
            platform: 'web',
            correctedBy: `${user.employee.firstName} ${user.employee.lastName}`
          }
        }
      })
      checkInOutRecords.push(checkInRecord)
    }

    if (data.checkOut) {
      const checkOutRecord = await prisma.checkInOut.create({
        data: {
          attendanceId: data.attendanceId,
          employeeId: attendanceRecord.employeeId,
          type: 'CHECK_OUT',
          timestamp: new Date(data.checkOut),
          method: 'WEB',
          ipAddress: clientIP,
          isManualEntry: true,
          manualReason: data.reason,
          approvedBy: user.employee.id,
          deviceInfo: {
            userAgent: request.headers.get('user-agent'),
            platform: 'web',
            correctedBy: `${user.employee.firstName} ${user.employee.lastName}`
          }
        }
      })
      checkInOutRecords.push(checkOutRecord)
    }

    // Log the correction action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CORRECT_ATTENDANCE',
        resource: 'ATTENDANCE',
        resourceId: data.attendanceId,
        oldValues: originalValues,
        newValues: {
          checkIn: data.checkIn ? new Date(data.checkIn) : attendanceRecord.checkIn,
          checkOut: data.checkOut ? new Date(data.checkOut) : attendanceRecord.checkOut,
          status: data.status,
          workHours: workHours ? workHours.toNumber() : attendanceRecord.workHours?.toNumber(),
          overtime: overtime ? overtime.toNumber() : attendanceRecord.overtime?.toNumber(),
          reason: data.reason,
          correctedBy: user.employee.id
        },
        ipAddress: clientIP,
        userAgent: request.headers.get('user-agent')
      }
    })

    return NextResponse.json({
      success: true,
      attendanceRecord: updatedRecord,
      checkInOutRecords,
      message: `Attendance corrected successfully for ${attendanceRecord.employee.firstName} ${attendanceRecord.employee.lastName}`
    })

  } catch (error) {
    console.error('Error correcting attendance:', error)
    return NextResponse.json(
      { error: 'Failed to correct attendance' },
      { status: 500 }
    )
  }
}
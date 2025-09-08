import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/attendance/status - Get current attendance status
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Get today's attendance record
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

    // Calculate current work hours if checked in
    let currentWorkHours = 0
    if (attendanceRecord?.checkIn && !attendanceRecord.checkOut) {
      const now = new Date()
      currentWorkHours = (now.getTime() - attendanceRecord.checkIn.getTime()) / (1000 * 60 * 60)
    }

    return NextResponse.json({
      hasCheckedIn: !!attendanceRecord?.checkIn,
      hasCheckedOut: !!attendanceRecord?.checkOut,
      checkInTime: attendanceRecord?.checkIn,
      checkOutTime: attendanceRecord?.checkOut,
      status: attendanceRecord?.status || 'NOT_MARKED',
      workHours: attendanceRecord?.workHours || currentWorkHours,
      overtime: attendanceRecord?.overtime || 0,
      currentWorkHours: Math.round(currentWorkHours * 100) / 100,
      location: attendanceRecord?.location,
      method: attendanceRecord?.method,
      checkInOutHistory: attendanceRecord?.checkInOut || []
    })

  } catch (error) {
    console.error('Error fetching attendance status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance status' },
      { status: 500 }
    )
  }
}
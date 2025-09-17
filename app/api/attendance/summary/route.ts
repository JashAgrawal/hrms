import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get employee data
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get today's attendance record
    const attendanceRecord = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: employee.id,
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // Get today's site visits
    const siteVisits = await prisma.siteVisit.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    const totalSiteVisits = siteVisits.length
    const activeSiteVisits = siteVisits.filter(visit => !visit.checkOutTime).length

    // Calculate work hours
    let totalWorkHours = 0
    if (attendanceRecord?.checkIn && attendanceRecord?.checkOut) {
      const checkInTime = new Date(attendanceRecord.checkIn)
      const checkOutTime = new Date(attendanceRecord.checkOut)
      totalWorkHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
    }

    const isComplete = !!(attendanceRecord?.checkIn && attendanceRecord?.checkOut)

    return NextResponse.json({
      checkInTime: attendanceRecord?.checkIn,
      checkOutTime: attendanceRecord?.checkOut,
      totalWorkHours: totalWorkHours > 0 ? totalWorkHours : undefined,
      totalSiteVisits,
      activeSiteVisits,
      status: attendanceRecord?.status || 'NOT_STARTED',
      method: attendanceRecord?.method,
      isComplete
    })

  } catch (error) {
    console.error('Error fetching attendance summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
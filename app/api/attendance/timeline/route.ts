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

    const timeline: any[] = []

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

    // Add check-in event
    if (attendanceRecord?.checkIn) {
      timeline.push({
        id: `checkin-${attendanceRecord.id}`,
        type: 'CHECK_IN',
        timestamp: attendanceRecord.checkIn,
        method: attendanceRecord.method,
        location: attendanceRecord.location
      })
    }

    // Get today's site visits for field employees
    if (employee.employeeType === 'FIELD_EMPLOYEE') {
      const siteVisits = await prisma.siteVisit.findMany({
        where: {
          employeeId: employee.id,
          date: {
            gte: today,
            lt: tomorrow
          }
        },
        include: {
          site: true
        },
        orderBy: {
          checkInTime: 'asc'
        }
      })

      // Add site visit events
      for (const visit of siteVisits) {
        // Site visit start
        timeline.push({
          id: `site-start-${visit.id}`,
          type: 'SITE_VISIT_START',
          timestamp: visit.checkInTime,
          site: visit.site ? {
            id: visit.site.id,
            name: visit.site.name,
            code: visit.site.code
          } : null,
          location: visit.locationName ? {
            name: visit.locationName
          } : null,
          purpose: visit.purpose
        })

        // Site visit end (if completed)
        if (visit.checkOutTime) {
          const duration = Math.floor((new Date(visit.checkOutTime).getTime() - new Date(visit.checkInTime).getTime()) / (1000 * 60))
          
          timeline.push({
            id: `site-end-${visit.id}`,
            type: 'SITE_VISIT_END',
            timestamp: visit.checkOutTime,
            site: visit.site ? {
              id: visit.site.id,
              name: visit.site.name,
              code: visit.site.code
            } : null,
            location: visit.locationName ? {
              name: visit.locationName
            } : null,
            duration
          })
        }
      }
    }

    // Add check-out event
    if (attendanceRecord?.checkOut) {
      timeline.push({
        id: `checkout-${attendanceRecord.id}`,
        type: 'CHECK_OUT',
        timestamp: attendanceRecord.checkOut,
        location: attendanceRecord.location
      })
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return NextResponse.json({
      timeline,
      employeeType: employee.employeeType
    })

  } catch (error) {
    console.error('Error fetching daily timeline:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
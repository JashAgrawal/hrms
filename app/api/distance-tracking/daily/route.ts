import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || '0')
    const year = parseInt(searchParams.get('year') || '0')
    const employeeId = searchParams.get('employeeId')

    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 })
    }

    // Get employee record
    let targetEmployeeId = employeeId
    if (!targetEmployeeId) {
      const employee = await prisma.employee.findUnique({
        where: { userId: session.user.id }
      })
      
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
      }
      
      targetEmployeeId = employee.id
    }

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    // Get daily distance records
    const dailyDistances = await prisma.dailyDistanceRecord.findMany({
      where: {
        employeeId: targetEmployeeId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    })

    // Get site visits for context
    const siteVisits = await prisma.siteVisit.findMany({
      where: {
        employeeId: targetEmployeeId,
        checkInTime: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        site: {
          select: {
            name: true,
            address: true
          }
        }
      },
      orderBy: { checkInTime: 'asc' }
    })

    // Group site visits by date
    const siteVisitsByDate = siteVisits.reduce((acc, visit) => {
      const dateKey = visit.checkInTime.toISOString().split('T')[0]
      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push({
        siteName: visit.site.name,
        checkInTime: visit.checkInTime.toISOString(),
        // Note: Distance tracking is handled separately via DistanceTrackingPoint model
      })
      return acc
    }, {} as Record<string, any[]>)

    // Format response
    const formattedData = dailyDistances.map((record: any) => ({
      date: record.date.toISOString().split('T')[0],
      totalDistance: record.totalDistance.toNumber(),
      checkInCount: record.checkInCount,
      locations: siteVisitsByDate[record.date.toISOString().split('T')[0]] || []
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error fetching daily distances:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
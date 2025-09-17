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
      where: { userId: session.user.id },
      include: {
        employeeSites: {
          include: {
            site: true
          }
        }
      }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check if user is a field employee
    if (employee.employeeType !== 'FIELD_EMPLOYEE') {
      return NextResponse.json({ error: 'Not a field employee' }, { status: 404 })
    }

    // Get active site visits
    const activeSiteVisits = await prisma.siteVisit.findMany({
      where: {
        employeeId: employee.id,
        checkOutTime: null
      },
      include: {
        site: true
      },
      orderBy: {
        checkInTime: 'desc'
      }
    })

    // Get today's visits count
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayVisitsCount = await prisma.siteVisit.count({
      where: {
        employeeId: employee.id,
        checkInTime: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    return NextResponse.json({
      isFieldEmployee: true,
      assignedSitesCount: employee.employeeSites.length,
      activeSiteVisits: activeSiteVisits.map(visit => ({
        id: visit.id,
        checkInTime: visit.checkInTime,
        purpose: visit.purpose,
        site: visit.site,
        isValidLocation: true // You can add location validation logic here
      })),
      todayVisitsCount
    })

  } catch (error) {
    console.error('Error fetching field employee data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
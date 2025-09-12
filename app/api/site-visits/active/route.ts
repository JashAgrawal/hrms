import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true, employeeType: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    if (employee.employeeType !== 'FIELD_EMPLOYEE') {
      return NextResponse.json(
        { error: 'Only field employees can have active site visits' },
        { status: 403 }
      )
    }

    // Get today's active site visits
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const activeSiteVisits = await prisma.siteVisit.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
        status: 'IN_PROGRESS',
      },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
            radius: true,
            siteType: true,
            contactPerson: true,
            contactPhone: true,
          },
        },
      },
      orderBy: { checkInTime: 'desc' },
    })

    return NextResponse.json({ activeSiteVisits })
  } catch (error) {
    console.error('Error fetching active site visits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch active site visits' },
      { status: 500 }
    )
  }
}
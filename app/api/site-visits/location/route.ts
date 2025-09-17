import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { locationName, checkInLocation, purpose, notes } = body

    // Get employee data
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Verify employee is a field employee
    if (employee.employeeType !== 'FIELD_EMPLOYEE') {
      return NextResponse.json({ error: 'Only field employees can check in at locations' }, { status: 403 })
    }

    // Create a location-based site visit (without a specific site)
    const now = new Date()
    const siteVisit = await prisma.siteVisit.create({
      data: {
        employeeId: employee.id,
        siteId: null, // No specific site for location-based visits
        date: now,
        checkInTime: now,
        checkInLocation: checkInLocation || {},
        purpose,
        notes,
        locationName // Store the location name provided by user
      }
    })

    return NextResponse.json({
      message: `Successfully checked in at ${locationName}`,
      siteVisit
    })

  } catch (error) {
    console.error('Error creating location-based site visit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
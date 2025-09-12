import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LocationService } from '@/lib/location-service'
import { z } from 'zod'

// Schema for location assignment
const locationAssignmentSchema = z.object({
  locations: z.array(z.object({
    name: z.string().min(1, 'Location name is required'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radius: z.number().min(10).max(1000),
    isOfficeLocation: z.boolean(),
    officeLocationId: z.string().optional()
  })).max(5, 'Maximum 5 locations can be assigned per employee')
})

// GET /api/employees/[id]/locations - Get employee's assigned locations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const employeeId = id

    // Check if user has permission to view employee locations
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Allow access if user is viewing their own locations or has HR/Admin role
    const canAccess = user.employee?.id === employeeId || 
                     user.role === 'ADMIN' || 
                     user.role === 'HR'

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const locations = await LocationService.getEmployeeLocations(employeeId)

    return NextResponse.json({
      success: true,
      locations
    })

  } catch (error) {
    console.error('Error fetching employee locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee locations' },
      { status: 500 }
    )
  }
}

// POST /api/employees/[id]/locations - Assign locations to employee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise <{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employeeId = (await params)?.id
    const body = await request.json()
    const data = locationAssignmentSchema.parse(body)

    // Check if user has permission to assign locations (HR/Admin only)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || (user.role !== 'ADMIN' && user.role !== 'HR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate that employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Validate office locations if any are referenced
    for (const location of data.locations) {
      if (location.isOfficeLocation && location.officeLocationId) {
        const officeLocation = await prisma.officeLocation.findUnique({
          where: { id: location.officeLocationId }
        })

        if (!officeLocation || !officeLocation.isActive) {
          return NextResponse.json(
            { error: `Office location not found: ${location.name}` },
            { status: 400 }
          )
        }
      }
    }

    // Add isActive property to locations
    const locationsWithActive = data.locations.map(location => ({
      ...location,
      isActive: true
    }))

    // Assign locations using LocationService
    await LocationService.assignLocationsToEmployee(
      employeeId,
      locationsWithActive,
      session.user.id
    )

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ASSIGN_EMPLOYEE_LOCATIONS',
        resource: 'EMPLOYEE_LOCATION',
        resourceId: employeeId,
        newValues: {
          employeeId,
          locationsCount: data.locations.length,
          locations: data.locations.map(l => ({
            name: l.name,
            isOfficeLocation: l.isOfficeLocation,
            radius: l.radius
          }))
        },
        ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
        userAgent: request.headers.get('user-agent')
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Location assignments saved successfully'
    })

  } catch (error) {
    console.error('Error assigning employee locations:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to assign locations' },
      { status: 500 }
    )
  }
}

// DELETE /api/employees/[id]/locations - Remove all location assignments
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employeeId =(await params).id // Accessing the id from the Promise<{ id: string }>

    // Check if user has permission to remove locations (HR/Admin only)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || (user.role !== 'ADMIN' && user.role !== 'HR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Deactivate all employee locations
    await prisma.employeeLocation.updateMany({
      where: { employeeId },
      data: { isActive: false }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REMOVE_EMPLOYEE_LOCATIONS',
        resource: 'EMPLOYEE_LOCATION',
        resourceId: employeeId,
        details: { employeeId },
        ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
        userAgent: request.headers.get('user-agent')
      }
    })

    return NextResponse.json({
      success: true,
      message: 'All location assignments removed successfully'
    })

  } catch (error) {
    console.error('Error removing employee locations:', error)
    return NextResponse.json(
      { error: 'Failed to remove location assignments' },
      { status: 500 }
    )
  }
}
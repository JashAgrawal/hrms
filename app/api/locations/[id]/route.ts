import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LocationService } from '@/lib/location-service'
import { z } from 'zod'

// Schema for office location update
const officeLocationUpdateSchema = z.object({
  name: z.string().min(1, 'Office name is required').optional(),
  code: z.string().min(1, 'Office code is required').max(10).optional(),
  address: z.string().min(1, 'Address is required').optional(),
  city: z.string().min(1, 'City is required').optional(),
  state: z.string().min(1, 'State is required').optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius: z.number().min(10).max(1000).optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional()
})

// PUT /api/locations/[id] - Update office location
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update office locations (Admin only)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const locationId = id
    const body = await request.json()
    const data = officeLocationUpdateSchema.parse(body)

    // Check if office location exists
    const existingLocation = await prisma.officeLocation.findUnique({
      where: { id: locationId }
    })

    if (!existingLocation) {
      return NextResponse.json({ error: 'Office location not found' }, { status: 404 })
    }

    // Check if office code already exists (if being updated)
    if (data.code && data.code !== existingLocation.code) {
      const existingOffice = await prisma.officeLocation.findUnique({
        where: { code: data.code }
      })

      if (existingOffice) {
        return NextResponse.json(
          { error: 'Office code already exists' },
          { status: 400 }
        )
      }
    }

    const updatedLocation = await LocationService.updateOfficeLocation(locationId, data)

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_OFFICE_LOCATION',
        resource: 'OFFICE_LOCATION',
        resourceId: locationId,
        oldValues: {
          name: existingLocation.name,
          code: existingLocation.code,
          city: existingLocation.city,
          state: existingLocation.state,
          coordinates: `${existingLocation.latitude}, ${existingLocation.longitude}`,
          radius: existingLocation.radius,
          isActive: existingLocation.isActive
        },
        newValues: {
          name: updatedLocation.name,
          code: updatedLocation.code,
          city: updatedLocation.city,
          state: updatedLocation.state,
          coordinates: `${updatedLocation.latitude}, ${updatedLocation.longitude}`,
          radius: updatedLocation.radius,
          isActive: updatedLocation.isActive
        },
        ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
        userAgent: request.headers.get('user-agent')
      }
    })

    return NextResponse.json({
      success: true,
      officeLocation: updatedLocation,
      message: 'Office location updated successfully'
    })

  } catch (error) {
    console.error('Error updating office location:', error)
    
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
      { error: 'Failed to update office location' },
      { status: 500 }
    )
  }
}

// DELETE /api/locations/[id] - Delete office location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete office locations (Admin only)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const locationId = id

    // Check if office location exists
    const existingLocation = await prisma.officeLocation.findUnique({
      where: { id: locationId }
    })

    if (!existingLocation) {
      return NextResponse.json({ error: 'Office location not found' }, { status: 404 })
    }

    await LocationService.deleteOfficeLocation(locationId)

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_OFFICE_LOCATION',
        resource: 'OFFICE_LOCATION',
        resourceId: locationId,
        oldValues: {
          name: existingLocation.name,
          code: existingLocation.code,
          city: existingLocation.city,
          state: existingLocation.state,
          coordinates: `${existingLocation.latitude}, ${existingLocation.longitude}`,
          radius: existingLocation.radius
        },
        ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
        userAgent: request.headers.get('user-agent')
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Office location deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting office location:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete office location' },
      { status: 500 }
    )
  }
}
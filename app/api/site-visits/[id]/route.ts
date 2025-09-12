import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auth } from '@/lib/auth'

const updateSiteVisitSchema = z.object({
  checkOutLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional(),
    timestamp: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
  photos: z.array(z.string()).optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED']).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const siteVisit = await prisma.siteVisit.findUnique({
      where: { id: id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            userId: true,
          },
        },
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
    })

    if (!siteVisit) {
      return NextResponse.json({ error: 'Site visit not found' }, { status: 404 })
    }

    // Check if user can access this site visit
    const canAccess = 
      ['ADMIN', 'HR'].includes(session.user.role) ||
      siteVisit.employee.userId === session.user.id

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(siteVisit)
  } catch (error) {
    console.error('Error fetching site visit:', error)
    return NextResponse.json(
      { error: 'Failed to fetch site visit' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateSiteVisitSchema.parse(body)

    // Get the site visit
    const siteVisit = await prisma.siteVisit.findUnique({
      where: { id: id },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    })

    if (!siteVisit) {
      return NextResponse.json({ error: 'Site visit not found' }, { status: 404 })
    }

    // Check if user can update this site visit
    const canUpdate = 
      ['ADMIN', 'HR'].includes(session.user.role) ||
      siteVisit.employee.userId === session.user.id

    if (!canUpdate) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const updateData: any = {}

    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes
    }

    if (validatedData.photos !== undefined) {
      updateData.photos = validatedData.photos
    }

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status
    }

    // Handle check-out
    if (validatedData.checkOutLocation) {
      updateData.checkOutTime = new Date()
      updateData.checkOutLocation = validatedData.checkOutLocation
      updateData.status = 'COMPLETED'

      // Calculate duration
      const checkInTime = new Date(siteVisit.checkInTime)
      const checkOutTime = new Date()
      const durationMs = checkOutTime.getTime() - checkInTime.getTime()
      updateData.duration = Math.round(durationMs / (1000 * 60)) // Duration in minutes
    }

    const updatedSiteVisit = await prisma.siteVisit.update({
      where: { id: id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        site: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            city: true,
            siteType: true,
          },
        },
      },
    })

    return NextResponse.json(updatedSiteVisit)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating site visit:', error)
    return NextResponse.json(
      { error: 'Failed to update site visit' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can delete site visits
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const siteVisit = await prisma.siteVisit.findUnique({
      where: { id: id },
    })

    if (!siteVisit) {
      return NextResponse.json({ error: 'Site visit not found' }, { status: 404 })
    }

    await prisma.siteVisit.delete({
      where: { id: id },
    })

    return NextResponse.json({ message: 'Site visit deleted successfully' })
  } catch (error) {
    console.error('Error deleting site visit:', error)
    return NextResponse.json(
      { error: 'Failed to delete site visit' },
      { status: 500 }
    )
  }
}
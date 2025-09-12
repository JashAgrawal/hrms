import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required').optional(),
  code: z.string().min(1, 'Site code is required').optional(),
  address: z.string().min(1, 'Address is required').optional(),
  city: z.string().min(1, 'City is required').optional(),
  state: z.string().min(1, 'State is required').optional(),
  country: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius: z.number().min(10).max(1000).optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  description: z.string().optional(),
  siteType: z.enum(['CLIENT', 'VENDOR', 'PARTNER', 'WAREHOUSE', 'OFFICE', 'OTHER']).optional(),
  isActive: z.boolean().optional(),
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
    const site = await prisma.site.findUnique({
      where: { id: id },
      include: {
        siteVisits: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
              },
            },
          },
          orderBy: { checkInTime: 'desc' },
          take: 10,
        },
        employeeSites: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                employeeType: true,
              },
            },
          },
          where: { isActive: true },
        },
        _count: {
          select: {
            siteVisits: true,
            employeeSites: true,
          },
        },
      },
    })

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    return NextResponse.json(site)
  } catch (error) {
    console.error('Error fetching site:', error)
    return NextResponse.json(
      { error: 'Failed to fetch site' },
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

    // Check if user has permission to update sites (Admin/HR)
    if (!['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateSiteSchema.parse(body)

    // Check if site exists
    const existingSite = await prisma.site.findUnique({
      where: { id: id },
    })

    if (!existingSite) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    // Check if code or name conflicts with other sites
    if (validatedData.code || validatedData.name) {
      const conflictingSite = await prisma.site.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(validatedData.code ? [{ code: validatedData.code }] : []),
                ...(validatedData.name ? [{ name: validatedData.name }] : []),
              ],
            },
          ],
        },
      })

      if (conflictingSite) {
        return NextResponse.json(
          { error: 'Site with this code or name already exists' },
          { status: 400 }
        )
      }
    }

    const updatedSite = await prisma.site.update({
      where: { id: id },
      data: validatedData,
    })

    return NextResponse.json(updatedSite)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating site:', error)
    return NextResponse.json(
      { error: 'Failed to update site' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete sites (Admin only)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    // Check if site exists
    const existingSite = await prisma.site.findUnique({
      where: { id: id },
      include: {
        _count: {
          select: {
            siteVisits: true,
            employeeSites: true,
          },
        },
      },
    })

    if (!existingSite) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    // Check if site has associated data
    if (existingSite._count.siteVisits > 0 || existingSite._count.employeeSites > 0) {
      // Soft delete by setting isActive to false
      const updatedSite = await prisma.site.update({
        where: { id: id },
        data: { isActive: false },
      })

      return NextResponse.json({
        message: 'Site deactivated successfully (has associated data)',
        site: updatedSite,
      })
    }

    // Hard delete if no associated data
    await prisma.site.delete({
      where: { id: id },
    })

    return NextResponse.json({ message: 'Site deleted successfully' })
  } catch (error) {
    console.error('Error deleting site:', error)
    return NextResponse.json(
      { error: 'Failed to delete site' },
      { status: 500 }
    )
  }
}
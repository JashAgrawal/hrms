import { NextRequest, NextResponse } from 'next/server'
import {auth} from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const assignSiteSchema = z.object({
  siteIds: z.array(z.string()).min(1, 'At least one site must be selected'),
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

    const resolvedParams = await params
    // Check if employee exists and is a field employee
    const employee = await prisma.employee.findUnique({
      where: { id: resolvedParams.id },
      select: { id: true, employeeType: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (employee.employeeType !== 'FIELD_EMPLOYEE') {
      return NextResponse.json(
        { error: 'Employee is not a field employee' },
        { status: 400 }
      )
    }

    const employeeSites = await prisma.employeeSite.findMany({
      where: {
        employeeId: resolvedParams.id,
        isActive: true,
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
      orderBy: { assignedAt: 'desc' },
    })

    return NextResponse.json({ employeeSites })
  } catch (error) {
    console.error('Error fetching employee sites:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee sites' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to assign sites (Admin/HR/Manager)
    if (!['ADMIN', 'HR', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const resolvedParams = await params
    const body = await request.json()
    const { siteIds } = assignSiteSchema.parse(body)

    // Check if employee exists and is a field employee
    const employee = await prisma.employee.findUnique({
      where: { id: resolvedParams.id },
      select: { id: true, employeeType: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (employee.employeeType !== 'FIELD_EMPLOYEE') {
      return NextResponse.json(
        { error: 'Employee is not a field employee' },
        { status: 400 }
      )
    }

    // Verify all sites exist
    const sites = await prisma.site.findMany({
      where: {
        id: { in: siteIds },
        isActive: true,
      },
    })

    if (sites.length !== siteIds.length) {
      return NextResponse.json(
        { error: 'One or more sites not found or inactive' },
        { status: 400 }
      )
    }

    // Remove existing assignments
    await prisma.employeeSite.updateMany({
      where: { employeeId: resolvedParams.id },
      data: { isActive: false },
    })

    // Create new assignments
    const employeeSites = await prisma.employeeSite.createMany({
      data: siteIds.map((siteId) => ({
        employeeId: resolvedParams.id,
        siteId,
        assignedBy: session.user.id,
      })),
    })

    // Fetch the created assignments with site details
    const createdAssignments = await prisma.employeeSite.findMany({
      where: {
        employeeId: resolvedParams.id,
        isActive: true,
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
          },
        },
      },
    })

    return NextResponse.json({
      message: 'Sites assigned successfully',
      employeeSites: createdAssignments,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error assigning sites to employee:', error)
    return NextResponse.json(
      { error: 'Failed to assign sites' },
      { status: 500 }
    )
  }
}
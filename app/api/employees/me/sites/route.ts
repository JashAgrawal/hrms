import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/employees/me/sites - Get current user's assigned sites
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    if (user.employee.employeeType !== 'FIELD_EMPLOYEE') {
      return NextResponse.json(
        { error: 'Only field employees have assigned sites' },
        { status: 400 }
      )
    }

    const employeeSites = await prisma.employeeSite.findMany({
      where: {
        employeeId: user.employee.id,
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
      { error: 'Failed to fetch assigned sites' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateHolidaySchema = z.object({
  name: z.string().min(1, 'Holiday name is required').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  type: z.enum(['PUBLIC', 'COMPANY', 'OPTIONAL', 'RELIGIOUS', 'NATIONAL']).optional(),
  description: z.string().optional(),
  isOptional: z.boolean().optional(),
  isActive: z.boolean().optional(),
  year: z.number().optional()
})

// GET /api/holidays/[id] - Get specific holiday
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const holiday = await prisma.holiday.findUnique({
      where: { id },
      include: {
        optionalLeavePolicyHolidays: {
          include: {
            policy: {
              select: {
                id: true,
                name: true,
                year: true,
                maxSelectableLeaves: true
              }
            }
          }
        },
        employeeOptionalLeaveSelections: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true
              }
            }
          }
        }
      }
    })

    if (!holiday) {
      return NextResponse.json(
        { error: 'Holiday not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Error fetching holiday:', error)
    return NextResponse.json(
      { error: 'Failed to fetch holiday' },
      { status: 500 }
    )
  }
}

// PUT /api/holidays/[id] - Update holiday (Admin/HR only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update holidays
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validation = updateHolidaySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid holiday data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const updateData: any = { ...validation.data }

    // If date is being updated, recalculate year
    if (updateData.date) {
      const holidayDate = new Date(updateData.date)
      updateData.year = holidayDate.getFullYear()
      updateData.date = holidayDate
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: updateData
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        resource: 'HOLIDAY',
        resourceId: id,
        newValues: holiday
      }
    })

    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Error updating holiday:', error)
    return NextResponse.json(
      { error: 'Failed to update holiday' },
      { status: 500 }
    )
  }
}

// DELETE /api/holidays/[id] - Delete holiday (Admin/HR only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete holidays
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if holiday exists
    const existingHoliday = await prisma.holiday.findUnique({
      where: { id }
    })

    if (!existingHoliday) {
      return NextResponse.json(
        { error: 'Holiday not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    const holiday = await prisma.holiday.update({
      where: { id },
      data: { isActive: false }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        resource: 'HOLIDAY',
        resourceId: id,
        oldValues: existingHoliday
      }
    })

    return NextResponse.json({ message: 'Holiday deleted successfully' })
  } catch (error) {
    console.error('Error deleting holiday:', error)
    return NextResponse.json(
      { error: 'Failed to delete holiday' },
      { status: 500 }
    )
  }
}

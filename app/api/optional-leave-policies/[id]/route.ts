import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateOptionalLeavePolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required').optional(),
  description: z.string().optional(),
  maxSelectableLeaves: z.number().int().min(1).max(20).optional(),
  selectionDeadline: z.string().optional(), // ISO date string
  isActive: z.boolean().optional(),
  holidayIds: z.array(z.string()).optional()
})

// GET /api/optional-leave-policies/[id] - Get specific policy
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

    const policy = await prisma.optionalLeavePolicy.findUnique({
      where: { id },
      include: {
        holidays: {
          include: {
            holiday: {
              select: {
                id: true,
                name: true,
                date: true,
                type: true,
                description: true
              }
            }
          }
        },
        employeeSelections: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true
              }
            },
            holiday: {
              select: {
                id: true,
                name: true,
                date: true
              }
            }
          }
        },
        _count: {
          select: {
            holidays: true,
            employeeSelections: true
          }
        }
      }
    })

    if (!policy) {
      return NextResponse.json(
        { error: 'Optional leave policy not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(policy)
  } catch (error) {
    console.error('Error fetching optional leave policy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch optional leave policy' },
      { status: 500 }
    )
  }
}

// PUT /api/optional-leave-policies/[id] - Update policy (Admin/HR only)
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

    // Check if user has permission to update policies
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validation = updateOptionalLeavePolicySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid policy data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { holidayIds, selectionDeadline, ...updateData } = validation.data

    // Get existing policy
    const existingPolicy = await prisma.optionalLeavePolicy.findUnique({
      where: { id },
      include: {
        holidays: true
      }
    })

    if (!existingPolicy) {
      return NextResponse.json(
        { error: 'Optional leave policy not found' },
        { status: 404 }
      )
    }

    // Update policy in transaction
    const updatedPolicy = await prisma.$transaction(async (tx) => {
      // Update basic policy data
      const policyUpdateData: any = { ...updateData }
      if (selectionDeadline) {
        policyUpdateData.selectionDeadline = new Date(selectionDeadline)
      }

      const policy = await tx.optionalLeavePolicy.update({
        where: { id },
        data: policyUpdateData
      })

      // Update holidays if provided
      if (holidayIds) {
        // Verify all holidays exist and are active
        const holidays = await tx.holiday.findMany({
          where: {
            id: { in: holidayIds },
            isActive: true,
            year: existingPolicy.year
          }
        })

        if (holidays.length !== holidayIds.length) {
          throw new Error('Some holidays not found or inactive')
        }

        // Validate that maxSelectableLeaves is not greater than available holidays
        const maxLeaves = updateData.maxSelectableLeaves || existingPolicy.maxSelectableLeaves
        if (maxLeaves > holidays.length) {
          throw new Error('Maximum selectable leaves cannot exceed available holidays')
        }

        // Remove existing holiday associations
        await tx.optionalLeavePolicyHoliday.deleteMany({
          where: { policyId: id }
        })

        // Create new holiday associations
        const policyHolidays = holidayIds.map(holidayId => ({
          policyId: id,
          holidayId
        }))

        await tx.optionalLeavePolicyHoliday.createMany({
          data: policyHolidays
        })
      }

      return policy
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        resource: 'OPTIONAL_LEAVE_POLICY',
        resourceId: id,
        newValues: { ...updatedPolicy, holidayIds }
      }
    })

    // Fetch the complete updated policy
    const completePolicy = await prisma.optionalLeavePolicy.findUnique({
      where: { id },
      include: {
        holidays: {
          include: {
            holiday: true
          }
        }
      }
    })

    return NextResponse.json(completePolicy)
  } catch (error) {
    console.error('Error updating optional leave policy:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update optional leave policy' },
      { status: 500 }
    )
  }
}

// DELETE /api/optional-leave-policies/[id] - Delete policy (Admin/HR only)
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

    // Check if user has permission to delete policies
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if policy exists
    const existingPolicy = await prisma.optionalLeavePolicy.findUnique({
      where: { id }
    })

    if (!existingPolicy) {
      return NextResponse.json(
        { error: 'Optional leave policy not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    const policy = await prisma.optionalLeavePolicy.update({
      where: { id },
      data: { isActive: false }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        resource: 'OPTIONAL_LEAVE_POLICY',
        resourceId: id,
        oldValues: existingPolicy
      }
    })

    return NextResponse.json({ message: 'Optional leave policy deleted successfully' })
  } catch (error) {
    console.error('Error deleting optional leave policy:', error)
    return NextResponse.json(
      { error: 'Failed to delete optional leave policy' },
      { status: 500 }
    )
  }
}

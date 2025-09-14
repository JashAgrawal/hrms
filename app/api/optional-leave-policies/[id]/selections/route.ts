import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const employeeSelectionSchema = z.object({
  holidayIds: z.array(z.string()).min(1, 'At least one holiday must be selected')
})

// GET /api/optional-leave-policies/[id]/selections - Get employee selections for a policy
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

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Check if policy exists
    const policy = await prisma.optionalLeavePolicy.findUnique({
      where: { id, isActive: true },
      include: {
        holidays: {
          include: {
            holiday: true
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

    // If specific employee requested and user is HR/Admin, get that employee's selections
    // Otherwise, get current user's selections
    const targetEmployeeId = employeeId && ['ADMIN', 'HR'].includes(currentUser.role) 
      ? employeeId 
      : currentUser.employee.id

    const selections = await prisma.employeeOptionalLeaveSelection.findMany({
      where: {
        policyId: id,
        employeeId: targetEmployeeId
      },
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
      },
      orderBy: {
        holiday: {
          date: 'asc'
        }
      }
    })

    return NextResponse.json({
      policy: {
        id: policy.id,
        name: policy.name,
        year: policy.year,
        maxSelectableLeaves: policy.maxSelectableLeaves,
        selectionDeadline: policy.selectionDeadline,
        availableHolidays: policy.holidays.map(ph => ph.holiday)
      },
      selections,
      selectedCount: selections.length,
      remainingSelections: policy.maxSelectableLeaves - selections.length
    })
  } catch (error) {
    console.error('Error fetching employee selections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee selections' },
      { status: 500 }
    )
  }
}

// POST /api/optional-leave-policies/[id]/selections - Make employee selections
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = employeeSelectionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid selection data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { holidayIds } = validation.data

    // Get policy with holidays
    const policy = await prisma.optionalLeavePolicy.findUnique({
      where: { id, isActive: true },
      include: {
        holidays: {
          include: {
            holiday: true
          }
        }
      }
    })

    if (!policy) {
      return NextResponse.json(
        { error: 'Optional leave policy not found or inactive' },
        { status: 404 }
      )
    }

    // Check if selection deadline has passed
    if (policy.selectionDeadline && new Date() > policy.selectionDeadline) {
      return NextResponse.json(
        { error: 'Selection deadline has passed' },
        { status: 400 }
      )
    }

    // Validate holiday IDs belong to this policy
    const policyHolidayIds = policy.holidays.map(ph => ph.holidayId)
    const invalidHolidayIds = holidayIds.filter(hId => !policyHolidayIds.includes(hId))
    
    if (invalidHolidayIds.length > 0) {
      return NextResponse.json(
        { error: 'Some holidays are not part of this policy' },
        { status: 400 }
      )
    }

    // Check if selection count exceeds maximum
    if (holidayIds.length > policy.maxSelectableLeaves) {
      return NextResponse.json(
        { error: `Cannot select more than ${policy.maxSelectableLeaves} holidays` },
        { status: 400 }
      )
    }

    // Update selections in transaction
    const selections = await prisma.$transaction(async (tx) => {
      // Remove existing selections for this employee and policy
      await tx.employeeOptionalLeaveSelection.deleteMany({
        where: {
          employeeId: currentUser.employee!.id,
          policyId: id
        }
      })

      // Create new selections
      const newSelections = holidayIds.map(holidayId => ({
        employeeId: currentUser.employee!.id,
        policyId: id,
        holidayId
      }))

      await tx.employeeOptionalLeaveSelection.createMany({
        data: newSelections
      })

      // Return the created selections with holiday details
      return await tx.employeeOptionalLeaveSelection.findMany({
        where: {
          employeeId: currentUser.employee!.id,
          policyId: id
        },
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
      })
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        resource: 'EMPLOYEE_OPTIONAL_LEAVE_SELECTION',
        newValues: { policyId: id, holidayIds, employeeId: currentUser.employee.id }
      }
    })

    return NextResponse.json({
      message: 'Optional leave selections updated successfully',
      selections,
      selectedCount: selections.length,
      remainingSelections: policy.maxSelectableLeaves - selections.length
    })
  } catch (error) {
    console.error('Error updating employee selections:', error)
    return NextResponse.json(
      { error: 'Failed to update employee selections' },
      { status: 500 }
    )
  }
}

// DELETE /api/optional-leave-policies/[id]/selections - Clear employee selections
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

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Check if policy exists and is active
    const policy = await prisma.optionalLeavePolicy.findUnique({
      where: { id, isActive: true }
    })

    if (!policy) {
      return NextResponse.json(
        { error: 'Optional leave policy not found or inactive' },
        { status: 404 }
      )
    }

    // Check if selection deadline has passed
    if (policy.selectionDeadline && new Date() > policy.selectionDeadline) {
      return NextResponse.json(
        { error: 'Selection deadline has passed' },
        { status: 400 }
      )
    }

    // Delete all selections for this employee and policy
    await prisma.employeeOptionalLeaveSelection.deleteMany({
      where: {
        employeeId: currentUser.employee.id,
        policyId: id
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        resource: 'EMPLOYEE_OPTIONAL_LEAVE_SELECTION',
        oldValues: { policyId: id, employeeId: currentUser.employee.id }
      }
    })

    return NextResponse.json({ message: 'Optional leave selections cleared successfully' })
  } catch (error) {
    console.error('Error clearing employee selections:', error)
    return NextResponse.json(
      { error: 'Failed to clear employee selections' },
      { status: 500 }
    )
  }
}

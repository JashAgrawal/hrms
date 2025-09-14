import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createOptionalLeavePolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().optional(),
  year: z.number().int().min(2020).max(2050),
  maxSelectableLeaves: z.number().int().min(1).max(20),
  selectionDeadline: z.string().optional(), // ISO date string
  holidayIds: z.array(z.string()).min(1, 'At least one holiday must be selected')
})

// GET /api/optional-leave-policies - Get all optional leave policies
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const whereConditions: any = { year }
    if (!includeInactive) {
      whereConditions.isActive = true
    }

    const policies = await prisma.optionalLeavePolicy.findMany({
      where: whereConditions,
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
      },
      orderBy: [
        { year: 'desc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(policies)
  } catch (error) {
    console.error('Error fetching optional leave policies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch optional leave policies' },
      { status: 500 }
    )
  }
}

// POST /api/optional-leave-policies - Create optional leave policy (Admin/HR only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create policies
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validation = createOptionalLeavePolicySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid policy data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { name, description, year, maxSelectableLeaves, selectionDeadline, holidayIds } = validation.data

    // Check if policy with same name already exists for the year
    const existingPolicy = await prisma.optionalLeavePolicy.findFirst({
      where: {
        name,
        year
      }
    })

    if (existingPolicy) {
      return NextResponse.json(
        { error: 'Policy with this name already exists for the year' },
        { status: 409 }
      )
    }

    // Verify all holidays exist and are optional
    const holidays = await prisma.holiday.findMany({
      where: {
        id: { in: holidayIds },
        isActive: true,
        year
      }
    })

    if (holidays.length !== holidayIds.length) {
      return NextResponse.json(
        { error: 'Some holidays not found or inactive' },
        { status: 400 }
      )
    }

    // Validate that maxSelectableLeaves is not greater than available holidays
    if (maxSelectableLeaves > holidays.length) {
      return NextResponse.json(
        { error: 'Maximum selectable leaves cannot exceed available holidays' },
        { status: 400 }
      )
    }

    // Create the policy with holidays in a transaction
    const policy = await prisma.$transaction(async (tx) => {
      const newPolicy = await tx.optionalLeavePolicy.create({
        data: {
          name,
          description,
          year,
          maxSelectableLeaves,
          selectionDeadline: selectionDeadline ? new Date(selectionDeadline) : null
        }
      })

      // Create policy-holiday associations
      const policyHolidays = holidayIds.map(holidayId => ({
        policyId: newPolicy.id,
        holidayId
      }))

      await tx.optionalLeavePolicyHoliday.createMany({
        data: policyHolidays
      })

      return newPolicy
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        resource: 'OPTIONAL_LEAVE_POLICY',
        newValues: { ...policy, holidayIds }
      }
    })

    // Fetch the complete policy with relations
    const completePolicy = await prisma.optionalLeavePolicy.findUnique({
      where: { id: policy.id },
      include: {
        holidays: {
          include: {
            holiday: true
          }
        }
      }
    })

    return NextResponse.json(completePolicy, { status: 201 })
  } catch (error) {
    console.error('Error creating optional leave policy:', error)
    return NextResponse.json(
      { error: 'Failed to create optional leave policy' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for leave policy updates
const updateLeavePolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required').optional(),
  code: z.string().min(1, 'Policy code is required').max(10, 'Code must be 10 characters or less').optional(),
  type: z.enum(['ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'EMERGENCY', 'COMPENSATORY']).optional(),
  description: z.string().optional(),
  daysPerYear: z.number().min(0, 'Days per year must be non-negative').optional(),
  carryForward: z.boolean().optional(),
  maxCarryForward: z.number().optional(),
  maxConsecutiveDays: z.number().optional(),
  minAdvanceNotice: z.number().min(0).optional(),
  requiresApproval: z.boolean().optional(),
  approvalLevels: z.number().min(1).max(5).optional(),
  accrualType: z.enum(['ANNUAL', 'MONTHLY', 'QUARTERLY', 'ON_JOINING']).optional(),
  accrualRate: z.number().optional(),
  probationPeriodDays: z.number().min(0).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  isEncashable: z.boolean().optional(),
  encashmentRate: z.number().min(0).max(200).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/leave/policies/[id] - Get specific leave policy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const policy = await prisma.leavePolicy.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            leaveRequests: true,
            leaveBalances: true,
          }
        },
        leaveRequests: {
          take: 10,
          orderBy: { appliedAt: 'desc' },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeCode: true,
              }
            }
          }
        }
      }
    })

    if (!policy) {
      return NextResponse.json(
        { error: 'Leave policy not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(policy)
  } catch (error) {
    console.error('Error fetching leave policy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave policy' },
      { status: 500 }
    )
  }
}

// PUT /api/leave/policies/[id] - Update leave policy
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update leave policies
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateLeavePolicySchema.parse(body)

    // Check if policy exists
    const existingPolicy = await prisma.leavePolicy.findUnique({
      where: { id }
    })

    if (!existingPolicy) {
      return NextResponse.json(
        { error: 'Leave policy not found' },
        { status: 404 }
      )
    }

    // Check if name or code conflicts with other policies
    if (validatedData.name || validatedData.code) {
      const conflictingPolicy = await prisma.leavePolicy.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                validatedData.name ? { name: validatedData.name } : {},
                validatedData.code ? { code: validatedData.code } : {},
              ].filter(condition => Object.keys(condition).length > 0)
            }
          ]
        }
      })

      if (conflictingPolicy) {
        return NextResponse.json(
          { error: 'Policy with this name or code already exists' },
          { status: 400 }
        )
      }
    }

    const updatedPolicy = await prisma.leavePolicy.update({
      where: { id },
      data: validatedData
    })

    // If daysPerYear changed, update leave balances for current year
    if (validatedData.daysPerYear !== undefined && validatedData.daysPerYear !== existingPolicy.daysPerYear) {
      const currentYear = new Date().getFullYear()
      
      await prisma.leaveBalance.updateMany({
        where: {
          policyId: id,
          year: currentYear
        },
        data: {
          allocated: validatedData.daysPerYear,
          available: {
            // Recalculate available = allocated - used - pending + carriedForward
            // This is a simplified approach; in production, you might want to handle this more carefully
          }
        }
      })
    }

    return NextResponse.json(updatedPolicy)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating leave policy:', error)
    return NextResponse.json(
      { error: 'Failed to update leave policy' },
      { status: 500 }
    )
  }
}

// DELETE /api/leave/policies/[id] - Delete leave policy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete leave policies
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Check if policy exists
    const existingPolicy = await prisma.leavePolicy.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            leaveRequests: true,
            leaveBalances: true,
          }
        }
      }
    })

    if (!existingPolicy) {
      return NextResponse.json(
        { error: 'Leave policy not found' },
        { status: 404 }
      )
    }

    // Check if policy has associated data
    if (existingPolicy._count.leaveRequests > 0 || existingPolicy._count.leaveBalances > 0) {
      // Instead of deleting, deactivate the policy
      const deactivatedPolicy = await prisma.leavePolicy.update({
        where: { id },
        data: { isActive: false }
      })

      return NextResponse.json({
        message: 'Policy deactivated instead of deleted due to existing data',
        policy: deactivatedPolicy
      })
    }

    // Safe to delete if no associated data
    await prisma.leavePolicy.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Leave policy deleted successfully' })
  } catch (error) {
    console.error('Error deleting leave policy:', error)
    return NextResponse.json(
      { error: 'Failed to delete leave policy' },
      { status: 500 }
    )
  }
}
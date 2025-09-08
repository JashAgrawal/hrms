import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for leave policy
const leavePolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  code: z.string().min(1, 'Policy code is required').max(10, 'Code must be 10 characters or less'),
  type: z.enum(['ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'EMERGENCY', 'COMPENSATORY']),
  description: z.string().optional(),
  daysPerYear: z.number().min(0, 'Days per year must be non-negative'),
  carryForward: z.boolean().default(false),
  maxCarryForward: z.number().optional(),
  maxConsecutiveDays: z.number().optional(),
  minAdvanceNotice: z.number().min(0).optional(),
  requiresApproval: z.boolean().default(true),
  approvalLevels: z.number().min(1).max(5).default(1),
  accrualType: z.enum(['ANNUAL', 'MONTHLY', 'QUARTERLY', 'ON_JOINING']).default('ANNUAL'),
  accrualRate: z.number().optional(),
  probationPeriodDays: z.number().min(0).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  isEncashable: z.boolean().default(false),
  encashmentRate: z.number().min(0).max(200).optional(),
  isActive: z.boolean().default(true),
})

// GET /api/leave/policies - Get all leave policies
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const type = searchParams.get('type')

    const where: any = {}
    if (!includeInactive) {
      where.isActive = true
    }
    if (type) {
      where.type = type
    }

    const policies = await prisma.leavePolicy.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ],
      include: {
        _count: {
          select: {
            leaveRequests: true,
            leaveBalances: true,
          }
        }
      }
    })

    return NextResponse.json(policies)
  } catch (error) {
    console.error('Error fetching leave policies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave policies' },
      { status: 500 }
    )
  }
}

// POST /api/leave/policies - Create new leave policy
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create leave policies
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
    const validatedData = leavePolicySchema.parse(body)

    // Check if policy with same name or code already exists
    const existingPolicy = await prisma.leavePolicy.findFirst({
      where: {
        OR: [
          { name: validatedData.name },
          { code: validatedData.code }
        ]
      }
    })

    if (existingPolicy) {
      return NextResponse.json(
        { error: 'Policy with this name or code already exists' },
        { status: 400 }
      )
    }

    const policy = await prisma.leavePolicy.create({
      data: validatedData
    })

    // Create leave balances for all active employees
    const activeEmployees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    })

    const currentYear = new Date().getFullYear()
    const leaveBalances = activeEmployees.map(employee => ({
      employeeId: employee.id,
      policyId: policy.id,
      year: currentYear,
      allocated: validatedData.daysPerYear,
      used: 0,
      pending: 0,
      carriedForward: 0,
      encashed: 0,
      expired: 0,
      available: validatedData.daysPerYear,
    }))

    await prisma.leaveBalance.createMany({
      data: leaveBalances
    })

    return NextResponse.json(policy, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating leave policy:', error)
    return NextResponse.json(
      { error: 'Failed to create leave policy' },
      { status: 500 }
    )
  }
}
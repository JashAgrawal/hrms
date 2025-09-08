import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for leave balance updates
const updateLeaveBalanceSchema = z.object({
  allocated: z.number().min(0).optional(),
  used: z.number().min(0).optional(),
  pending: z.number().min(0).optional(),
  carriedForward: z.number().min(0).optional(),
  encashed: z.number().min(0).optional(),
  expired: z.number().min(0).optional(),
})

// GET /api/leave/balances - Get leave balances
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const year = searchParams.get('year')
    const policyId = searchParams.get('policyId')

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Build where clause
    const where: any = {}

    // If specific employee requested, check permissions
    if (employeeId) {
      if (!currentUser.employee || (employeeId !== currentUser.employee.id && !['ADMIN', 'HR', 'MANAGER'].includes(currentUser.role))) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      where.employeeId = employeeId
    } else {
      // If no specific employee, show current user's balances
      if (currentUser.employee) {
        where.employeeId = currentUser.employee.id
      } else {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
      }
    }

    if (year) {
      where.year = parseInt(year)
    } else {
      where.year = new Date().getFullYear()
    }

    if (policyId) {
      where.policyId = policyId
    }

    const balances = await prisma.leaveBalance.findMany({
      where,
      include: {
        policy: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            daysPerYear: true,
            carryForward: true,
            maxCarryForward: true,
            isEncashable: true,
            encashmentRate: true,
          }
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          }
        }
      },
      orderBy: [
        { policy: { type: 'asc' } },
        { policy: { name: 'asc' } }
      ]
    })

    // Calculate available balance for each record
    const balancesWithAvailable = balances.map(balance => ({
      ...balance,
      available: Number(balance.allocated) + Number(balance.carriedForward) - Number(balance.used) - Number(balance.pending) - Number(balance.expired)
    }))

    return NextResponse.json(balancesWithAvailable)
  } catch (error) {
    console.error('Error fetching leave balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave balances' },
      { status: 500 }
    )
  }
}

// POST /api/leave/balances - Create or update leave balance
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to manage leave balances
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
    const { employeeId, policyId, year, ...balanceData } = body

    if (!employeeId || !policyId || !year) {
      return NextResponse.json(
        { error: 'Employee ID, Policy ID, and Year are required' },
        { status: 400 }
      )
    }

    const validatedData = updateLeaveBalanceSchema.parse(balanceData)

    // Check if employee and policy exist
    const [employee, policy] = await Promise.all([
      prisma.employee.findUnique({ where: { id: employeeId } }),
      prisma.leavePolicy.findUnique({ where: { id: policyId } })
    ])

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (!policy) {
      return NextResponse.json({ error: 'Leave policy not found' }, { status: 404 })
    }

    // Calculate available balance
    const available = (validatedData.allocated || 0) + 
                     (validatedData.carriedForward || 0) - 
                     (validatedData.used || 0) - 
                     (validatedData.pending || 0) - 
                     (validatedData.expired || 0)

    const balance = await prisma.leaveBalance.upsert({
      where: {
        employeeId_policyId_year: {
          employeeId,
          policyId,
          year: parseInt(year)
        }
      },
      update: {
        ...validatedData,
        available,
        lastAccrualDate: new Date(),
      },
      create: {
        employeeId,
        policyId,
        year: parseInt(year),
        allocated: validatedData.allocated || policy.daysPerYear,
        used: validatedData.used || 0,
        pending: validatedData.pending || 0,
        carriedForward: validatedData.carriedForward || 0,
        encashed: validatedData.encashed || 0,
        expired: validatedData.expired || 0,
        available,
        lastAccrualDate: new Date(),
      },
      include: {
        policy: {
          select: {
            name: true,
            code: true,
            type: true,
          }
        },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          }
        }
      }
    })

    return NextResponse.json(balance, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating/updating leave balance:', error)
    return NextResponse.json(
      { error: 'Failed to create/update leave balance' },
      { status: 500 }
    )
  }
}
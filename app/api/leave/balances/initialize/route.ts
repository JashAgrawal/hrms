import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LeaveService } from '@/lib/leave-service'

// POST /api/leave/balances/initialize - Initialize leave balances for all employees
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to initialize leave balances
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

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const employeeId = searchParams.get('employeeId')

    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    // Get employees to initialize
    const whereClause: any = { status: 'ACTIVE' }
    if (employeeId) {
      whereClause.id = employeeId
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        joiningDate: true,
        gender: true,
      }
    })

    // Get active leave policies
    const policies = await prisma.leavePolicy.findMany({
      where: { isActive: true }
    })

    let initializedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const employee of employees) {
      try {
        for (const policy of policies) {
          // Skip gender-specific policies if they don't apply
          if (policy.gender && employee.gender !== policy.gender) {
            continue
          }

          // Check if balance already exists
          const existingBalance = await prisma.leaveBalance.findUnique({
            where: {
              employeeId_policyId_year: {
                employeeId: employee.id,
                policyId: policy.id,
                year: targetYear
              }
            }
          })

          if (existingBalance) {
            skippedCount++
            continue
          }

          // Calculate accrued days
          const accruedDays = await LeaveService.calculateAccrual(
            employee as any,
            policy,
            new Date(targetYear, 11, 31) // End of target year
          )

          // Create leave balance
          await prisma.leaveBalance.create({
            data: {
              employeeId: employee.id,
              policyId: policy.id,
              year: targetYear,
              allocated: accruedDays,
              used: 0,
              pending: 0,
              carriedForward: 0,
              encashed: 0,
              expired: 0,
              available: accruedDays,
              lastAccrualDate: new Date()
            }
          })

          initializedCount++
        }
      } catch (error) {
        console.error(`Error initializing balances for employee ${employee.employeeCode}:`, error)
        errors.push(`Failed to initialize balances for ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`)
      }
    }

    return NextResponse.json({
      message: 'Leave balance initialization completed',
      summary: {
        employeesProcessed: employees.length,
        balancesInitialized: initializedCount,
        balancesSkipped: skippedCount,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error initializing leave balances:', error)
    return NextResponse.json(
      { error: 'Failed to initialize leave balances' },
      { status: 500 }
    )
  }
}

// GET /api/leave/balances/initialize - Get initialization status
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    // Get counts
    const [totalEmployees, totalPolicies, totalBalances] = await Promise.all([
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.leavePolicy.count({ where: { isActive: true } }),
      prisma.leaveBalance.count({ where: { year: targetYear } })
    ])

    const expectedBalances = totalEmployees * totalPolicies
    const initializationPercentage = expectedBalances > 0 ? (totalBalances / expectedBalances) * 100 : 0

    // Get employees without balances
    const employeesWithoutBalances = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        leaveBalances: {
          none: {
            year: targetYear
          }
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
      },
      take: 10 // Limit to first 10 for display
    })

    return NextResponse.json({
      year: targetYear,
      totalEmployees,
      totalPolicies,
      totalBalances,
      expectedBalances,
      initializationPercentage: Math.round(initializationPercentage),
      isFullyInitialized: totalBalances >= expectedBalances,
      employeesWithoutBalances: employeesWithoutBalances.slice(0, 5), // Show first 5
      hasMoreEmployeesWithoutBalances: employeesWithoutBalances.length > 5
    })
  } catch (error) {
    console.error('Error getting initialization status:', error)
    return NextResponse.json(
      { error: 'Failed to get initialization status' },
      { status: 500 }
    )
  }
}
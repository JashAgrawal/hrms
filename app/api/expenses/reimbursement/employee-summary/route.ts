import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const employeeSummarySchema = z.object({
  employeeId: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  includeDetails: z.boolean().default(true),
  includePending: z.boolean().default(true)
})

// GET /api/expenses/reimbursement/employee-summary - Get employee payment summary
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const query = employeeSummarySchema.parse(Object.fromEntries(searchParams))

    // Determine which employee(s) to show based on role and request
    let targetEmployeeId = query.employeeId

    // Role-based access control
    if (user.role === 'EMPLOYEE') {
      // Employees can only see their own summary
      if (!user.employee) {
        return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 })
      }
      targetEmployeeId = user.employee.id
    } else if (user.role === 'MANAGER') {
      // Managers can see their team members' summaries
      if (query.employeeId) {
        const employee = await prisma.employee.findUnique({
          where: { id: query.employeeId }
        })
        
        if (!employee || employee.reportingTo !== user.employee?.id) {
          return NextResponse.json({ error: 'Access denied to this employee data' }, { status: 403 })
        }
      }
    } else if (!['ADMIN', 'FINANCE', 'HR'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Set default date range if not provided (last 12 months)
    const defaultEndDate = new Date()
    const defaultStartDate = new Date()
    defaultStartDate.setFullYear(defaultStartDate.getFullYear() - 1)

    const startDate = query.startDate || defaultStartDate
    const endDate = query.endDate || defaultEndDate

    if (targetEmployeeId) {
      // Get summary for specific employee
      const summary = await getEmployeePaymentSummary(targetEmployeeId, startDate, endDate, query.includeDetails, query.includePending)
      return NextResponse.json(summary)
    } else {
      // Get summaries for all employees (admin/finance/hr only)
      if (!['ADMIN', 'FINANCE', 'HR'].includes(user.role)) {
        return NextResponse.json({ error: 'Employee ID required for this role' }, { status: 400 })
      }

      const summaries = await getAllEmployeePaymentSummaries(startDate, endDate, query.includeDetails, query.includePending)
      return NextResponse.json(summaries)
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching employee payment summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get payment summary for a specific employee
async function getEmployeePaymentSummary(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  includeDetails: boolean,
  includePending: boolean
) {
  // Get employee details
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      email: true,
      bankAccountNumber: true,
      bankIFSC: true,
      bankName: true,
      bankBranch: true,
      department: {
        select: {
          name: true,
          code: true
        }
      }
    }
  })

  if (!employee) {
    throw new Error('Employee not found')
  }

  // Get reimbursed claims statistics
  const reimbursedStats = await prisma.expenseClaim.aggregate({
    where: {
      employeeId,
      status: 'REIMBURSED',
      reimbursedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: { id: true },
    _sum: { reimbursementAmount: true },
    _avg: { reimbursementAmount: true },
    _max: { reimbursementAmount: true },
    _min: { reimbursementAmount: true }
  })

  // Get pending claims statistics if requested
  let pendingStats = null
  if (includePending) {
    pendingStats = await prisma.expenseClaim.aggregate({
      where: {
        employeeId,
        status: 'APPROVED',
        isReimbursable: true,
        reimbursedAt: null
      },
      _count: { id: true },
      _sum: { amount: true }
    })
  }

  // Get monthly breakdown
  const monthlyBreakdown = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('month', reimbursed_at) as month,
      COUNT(*) as claim_count,
      SUM(reimbursement_amount) as total_amount
    FROM expense_claims 
    WHERE employee_id = ${employeeId}
      AND reimbursed_at >= ${startDate}
      AND reimbursed_at <= ${endDate}
      AND status = 'REIMBURSED'
    GROUP BY DATE_TRUNC('month', reimbursed_at)
    ORDER BY month DESC
  `

  // Get category breakdown
  const categoryBreakdown = await prisma.expenseClaim.groupBy({
    by: ['categoryId'],
    where: {
      employeeId,
      status: 'REIMBURSED',
      reimbursedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: { id: true },
    _sum: { reimbursementAmount: true }
  })

  // Get category names
  const categoryIds = categoryBreakdown.map(cb => cb.categoryId).filter(Boolean)
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, code: true }
  })

  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat
    return acc
  }, {} as Record<string, any>)

  // Get recent payments if details requested
  let recentPayments = null
  if (includeDetails) {
    recentPayments = await prisma.expenseClaim.findMany({
      where: {
        employeeId,
        status: 'REIMBURSED',
        reimbursedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        title: true,
        amount: true,
        reimbursementAmount: true,
        reimbursedAt: true,
        category: {
          select: {
            name: true,
            code: true
          }
        },
        reimbursementBatch: {
          select: {
            batchId: true,
            paymentMethod: true,
            referenceNumber: true
          }
        }
      },
      orderBy: { reimbursedAt: 'desc' },
      take: 20 // Last 20 payments
    })
  }

  // Calculate average processing time
  const processingTimes = await prisma.expenseClaim.findMany({
    where: {
      employeeId,
      status: 'REIMBURSED',
      reimbursedAt: { not: null },
      approvedAt: { not: null }
    },
    select: {
      approvedAt: true,
      reimbursedAt: true
    },
    take: 50 // Last 50 for average calculation
  })

  const avgProcessingTime = processingTimes.length > 0
    ? processingTimes.reduce((sum, claim) => {
        const processingTime = claim.reimbursedAt!.getTime() - claim.approvedAt!.getTime()
        return sum + (processingTime / (1000 * 60 * 60 * 24)) // Convert to days
      }, 0) / processingTimes.length
    : 0

  return {
    employee: {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      code: employee.employeeCode,
      email: employee.email,
      department: employee.department?.name,
      bankDetails: {
        accountNumber: employee.bankAccountNumber ? 
          employee.bankAccountNumber.replace(/\d(?=\d{4})/g, '*') : null,
        ifscCode: employee.bankIFSC,
        bankName: employee.bankName,
        bankBranch: employee.bankBranch
      }
    },
    period: {
      startDate,
      endDate
    },
    summary: {
      totalReimbursed: reimbursedStats._sum.reimbursementAmount?.toNumber() || 0,
      totalClaims: reimbursedStats._count.id,
      averageAmount: reimbursedStats._avg.reimbursementAmount?.toNumber() || 0,
      maxAmount: reimbursedStats._max.reimbursementAmount?.toNumber() || 0,
      minAmount: reimbursedStats._min.reimbursementAmount?.toNumber() || 0,
      avgProcessingTime: Math.round(avgProcessingTime * 10) / 10,
      ...(pendingStats && {
        pendingAmount: pendingStats._sum.amount?.toNumber() || 0,
        pendingClaims: pendingStats._count.id
      })
    },
    monthlyBreakdown: (monthlyBreakdown as any[]).map((row: any) => ({
      month: row.month,
      claimCount: Number(row.claim_count),
      totalAmount: Number(row.total_amount)
    })),
    categoryBreakdown: categoryBreakdown.map(cb => ({
      category: {
        id: cb.categoryId,
        name: categoryMap[cb.categoryId || '']?.name || 'Uncategorized',
        code: categoryMap[cb.categoryId || '']?.code
      },
      claimCount: cb._count.id,
      totalAmount: cb._sum.reimbursementAmount?.toNumber() || 0
    })).sort((a, b) => b.totalAmount - a.totalAmount),
    ...(recentPayments && {
      recentPayments: recentPayments.map(payment => ({
        id: payment.id,
        title: payment.title,
        amount: payment.amount.toNumber(),
        reimbursementAmount: payment.reimbursementAmount?.toNumber() || 0,
        reimbursedAt: payment.reimbursedAt,
        category: payment.category?.name,
        batch: payment.reimbursementBatch ? {
          batchId: payment.reimbursementBatch.batchId,
          paymentMethod: payment.reimbursementBatch.paymentMethod,
          referenceNumber: payment.reimbursementBatch.referenceNumber
        } : null
      }))
    })
  }
}

// Get payment summaries for all employees
async function getAllEmployeePaymentSummaries(
  startDate: Date,
  endDate: Date,
  includeDetails: boolean,
  includePending: boolean
) {
  // Get all employees with reimbursements in the period
  const employeesWithReimbursements = await prisma.$queryRaw`
    SELECT DISTINCT 
      e.id,
      e.first_name,
      e.last_name,
      e.employee_code,
      e.email,
      d.name as department_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    INNER JOIN expense_claims ec ON e.id = ec.employee_id
    WHERE ec.reimbursed_at >= ${startDate}
      AND ec.reimbursed_at <= ${endDate}
      AND ec.status = 'REIMBURSED'
    ORDER BY e.first_name, e.last_name
  `

  const summaries = []

  for (const emp of employeesWithReimbursements as any[]) {
    // Get reimbursement statistics for each employee
    const stats = await prisma.expenseClaim.aggregate({
      where: {
        employeeId: emp.id,
        status: 'REIMBURSED',
        reimbursedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      _count: { id: true },
      _sum: { reimbursementAmount: true },
      _avg: { reimbursementAmount: true }
    })

    // Get pending statistics if requested
    let pendingStats = null
    if (includePending) {
      pendingStats = await prisma.expenseClaim.aggregate({
        where: {
          employeeId: emp.id,
          status: 'APPROVED',
          isReimbursable: true,
          reimbursedAt: null
        },
        _count: { id: true },
        _sum: { amount: true }
      })
    }

    summaries.push({
      employee: {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        code: emp.employee_code,
        email: emp.email,
        department: emp.department_name
      },
      summary: {
        totalReimbursed: stats._sum.reimbursementAmount?.toNumber() || 0,
        totalClaims: stats._count.id,
        averageAmount: stats._avg.reimbursementAmount?.toNumber() || 0,
        ...(pendingStats && {
          pendingAmount: pendingStats._sum.amount?.toNumber() || 0,
          pendingClaims: pendingStats._count.id
        })
      }
    })
  }

  // Sort by total reimbursed amount (descending)
  summaries.sort((a, b) => b.summary.totalReimbursed - a.summary.totalReimbursed)

  return {
    period: {
      startDate,
      endDate
    },
    totalEmployees: summaries.length,
    totalReimbursed: summaries.reduce((sum, s) => sum + s.summary.totalReimbursed, 0),
    totalClaims: summaries.reduce((sum, s) => sum + s.summary.totalClaims, 0),
    employees: summaries
  }
}
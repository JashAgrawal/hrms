import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } from 'date-fns'

const reportsQuerySchema = z.object({
  reportType: z.enum(['summary', 'detailed', 'analytics', 'compliance', 'trends']).default('summary'),
  period: z.enum(['current_month', 'last_month', 'current_year', 'last_year', 'custom']).default('current_month'),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  employeeId: z.string().optional(),
  departmentId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED', 'CANCELLED']).optional(),
  groupBy: z.enum(['employee', 'department', 'category', 'month', 'status']).optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    const canViewReports = ['ADMIN', 'FINANCE', 'HR', 'MANAGER'].includes(user?.role || '')
    
    if (!canViewReports) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = reportsQuerySchema.parse(Object.fromEntries(searchParams))

    // Determine date range
    let startDate: Date
    let endDate: Date

    switch (query.period) {
      case 'current_month':
        startDate = startOfMonth(new Date())
        endDate = endOfMonth(new Date())
        break
      case 'last_month':
        const lastMonth = subMonths(new Date(), 1)
        startDate = startOfMonth(lastMonth)
        endDate = endOfMonth(lastMonth)
        break
      case 'current_year':
        startDate = startOfYear(new Date())
        endDate = endOfYear(new Date())
        break
      case 'last_year':
        const lastYear = new Date()
        lastYear.setFullYear(lastYear.getFullYear() - 1)
        startDate = startOfYear(lastYear)
        endDate = endOfYear(lastYear)
        break
      case 'custom':
        if (!query.startDate || !query.endDate) {
          return NextResponse.json(
            { error: 'Start date and end date are required for custom period' },
            { status: 400 }
          )
        }
        startDate = query.startDate
        endDate = query.endDate
        break
      default:
        startDate = startOfMonth(new Date())
        endDate = endOfMonth(new Date())
    }

    // Build base filter
    const baseWhere: any = {
      expenseDate: {
        gte: startDate,
        lte: endDate
      }
    }

    if (query.employeeId) {
      baseWhere.employeeId = query.employeeId
    }

    if (query.categoryId) {
      baseWhere.categoryId = query.categoryId
    }

    if (query.status) {
      baseWhere.status = query.status
    }

    if (query.departmentId) {
      baseWhere.employee = {
        departmentId: query.departmentId
      }
    }

    // Generate report based on type
    let reportData: any = {}

    switch (query.reportType) {
      case 'summary':
        reportData = await generateSummaryReport(baseWhere, startDate, endDate)
        break
      case 'detailed':
        reportData = await generateDetailedReport(baseWhere, query.groupBy)
        break
      case 'analytics':
        reportData = await generateAnalyticsReport(baseWhere, startDate, endDate)
        break
      case 'compliance':
        reportData = await generateComplianceReport(baseWhere, startDate, endDate)
        break
      case 'trends':
        reportData = await generateTrendsReport(baseWhere, startDate, endDate)
        break
    }

    return NextResponse.json({
      reportType: query.reportType,
      period: {
        type: query.period,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd')
      },
      filters: {
        employeeId: query.employeeId,
        departmentId: query.departmentId,
        categoryId: query.categoryId,
        status: query.status
      },
      data: reportData,
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error generating expense report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function generateSummaryReport(baseWhere: any, startDate: Date, endDate: Date) {
  // Get overall statistics
  const totalClaims = await prisma.expenseClaim.count({ where: baseWhere })
  
  const totalAmount = await prisma.expenseClaim.aggregate({
    where: baseWhere,
    _sum: { amount: true }
  })

  // Status breakdown
  const statusBreakdown = await prisma.expenseClaim.groupBy({
    by: ['status'],
    where: baseWhere,
    _count: { id: true },
    _sum: { amount: true }
  })

  // Category breakdown
  const categoryBreakdown = await prisma.expenseClaim.groupBy({
    by: ['categoryId'],
    where: baseWhere,
    _count: { id: true },
    _sum: { amount: true }
  })

  // Get category names
  const categories = await prisma.expenseCategory.findMany({
    where: {
      id: { in: categoryBreakdown.map(c => c.categoryId) }
    },
    select: { id: true, name: true }
  })

  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat.name
    return acc
  }, {} as Record<string, string>)

  // Average processing time
  const processedClaims = await prisma.expenseClaim.findMany({
    where: {
      ...baseWhere,
      status: { in: ['APPROVED', 'REJECTED'] },
      approvedAt: { not: null }
    },
    select: {
      createdAt: true,
      approvedAt: true
    }
  })

  const avgProcessingTime = processedClaims.length > 0
    ? processedClaims.reduce((sum, claim) => {
        const processingTime = claim.approvedAt!.getTime() - claim.createdAt.getTime()
        return sum + (processingTime / (1000 * 60 * 60 * 24)) // Convert to days
      }, 0) / processedClaims.length
    : 0

  return {
    overview: {
      totalClaims,
      totalAmount: totalAmount._sum.amount?.toNumber() || 0,
      avgClaimAmount: totalClaims > 0 ? (totalAmount._sum.amount?.toNumber() || 0) / totalClaims : 0,
      avgProcessingTime: Math.round(avgProcessingTime * 10) / 10
    },
    statusBreakdown: statusBreakdown.map(item => ({
      status: item.status,
      count: item._count.id,
      amount: item._sum.amount?.toNumber() || 0,
      percentage: totalClaims > 0 ? Math.round((item._count.id / totalClaims) * 100) : 0
    })),
    categoryBreakdown: categoryBreakdown.map(item => ({
      categoryId: item.categoryId,
      categoryName: categoryMap[item.categoryId] || 'Unknown',
      count: item._count.id,
      amount: item._sum.amount?.toNumber() || 0,
      percentage: totalClaims > 0 ? Math.round((item._count.id / totalClaims) * 100) : 0
    }))
  }
}

async function generateDetailedReport(baseWhere: any, groupBy?: string) {
  const expenseClaims = await prisma.expenseClaim.findMany({
    where: baseWhere,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          department: {
            select: { id: true, name: true }
          }
        }
      },
      category: {
        select: { id: true, name: true, code: true }
      },
      approvals: {
        select: {
          level: true,
          status: true,
          approvedAt: true,
          rejectedAt: true,
          approverName: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  if (groupBy) {
    const grouped = expenseClaims.reduce((acc, claim) => {
      let key: string
      
      switch (groupBy) {
        case 'employee':
          key = `${claim.employee.firstName} ${claim.employee.lastName}`
          break
        case 'department':
          key = claim.employee.department.name
          break
        case 'category':
          key = claim.category.name
          break
        case 'month':
          key = format(claim.expenseDate, 'yyyy-MM')
          break
        case 'status':
          key = claim.status
          break
        default:
          key = 'All'
      }

      if (!acc[key]) {
        acc[key] = {
          groupKey: key,
          claims: [],
          totalAmount: 0,
          count: 0
        }
      }

      acc[key].claims.push(claim)
      acc[key].totalAmount += claim.amount.toNumber()
      acc[key].count += 1

      return acc
    }, {} as Record<string, any>)

    return {
      groupBy,
      groups: Object.values(grouped)
    }
  }

  return {
    claims: expenseClaims,
    totalCount: expenseClaims.length,
    totalAmount: expenseClaims.reduce((sum, claim) => sum + claim.amount.toNumber(), 0)
  }
}

async function generateAnalyticsReport(baseWhere: any, startDate: Date, endDate: Date) {
  // Monthly trends
  const monthlyTrends = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('month', expense_date) as month,
      COUNT(*) as claim_count,
      SUM(amount) as total_amount,
      AVG(amount) as avg_amount
    FROM expense_claims 
    WHERE expense_date >= ${startDate} AND expense_date <= ${endDate}
    GROUP BY DATE_TRUNC('month', expense_date)
    ORDER BY month
  `

  // Top spenders
  const topSpenders = await prisma.expenseClaim.groupBy({
    by: ['employeeId'],
    where: baseWhere,
    _count: { id: true },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 10
  })

  // Get employee details for top spenders
  const employeeIds = topSpenders.map(s => s.employeeId)
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      department: { select: { name: true } }
    }
  })

  const employeeMap = employees.reduce((acc, emp) => {
    acc[emp.id] = emp
    return acc
  }, {} as Record<string, any>)

  // Policy violations analysis
  const violationClaims = await prisma.expenseClaim.findMany({
    where: {
      ...baseWhere,
      policyViolations: { not: null }
    },
    select: {
      id: true,
      amount: true,
      policyViolations: true,
      status: true
    }
  })

  const violationStats = violationClaims.reduce((acc, claim) => {
    const violations = claim.policyViolations as any[]
    if (violations && Array.isArray(violations)) {
      violations.forEach(violation => {
        if (!acc[violation.rule]) {
          acc[violation.rule] = { count: 0, totalAmount: 0 }
        }
        acc[violation.rule].count += 1
        acc[violation.rule].totalAmount += claim.amount.toNumber()
      })
    }
    return acc
  }, {} as Record<string, any>)

  return {
    monthlyTrends,
    topSpenders: topSpenders.map(spender => ({
      employee: employeeMap[spender.employeeId],
      claimCount: spender._count.id,
      totalAmount: spender._sum.amount?.toNumber() || 0
    })),
    policyViolations: {
      totalViolations: violationClaims.length,
      violationsByType: violationStats
    },
    insights: {
      highestClaimAmount: Math.max(...(await prisma.expenseClaim.findMany({
        where: baseWhere,
        select: { amount: true }
      })).map(c => c.amount.toNumber())),
      mostCommonCategory: await getMostCommonCategory(baseWhere),
      approvalRate: await getApprovalRate(baseWhere)
    }
  }
}

async function generateComplianceReport(baseWhere: any, startDate: Date, endDate: Date) {
  // Policy compliance metrics
  const totalClaims = await prisma.expenseClaim.count({ where: baseWhere })
  
  const claimsWithViolations = await prisma.expenseClaim.count({
    where: {
      ...baseWhere,
      policyViolations: { not: null }
    }
  })

  // Receipt compliance
  const claimsRequiringReceipts = await prisma.expenseClaim.count({
    where: {
      ...baseWhere,
      category: { requiresReceipt: true }
    }
  })

  const claimsWithReceipts = await prisma.expenseClaim.count({
    where: {
      ...baseWhere,
      category: { requiresReceipt: true },
      attachments: { some: {} }
    }
  })

  // Approval compliance
  const claimsRequiringApproval = await prisma.expenseClaim.count({
    where: {
      ...baseWhere,
      category: { requiresApproval: true }
    }
  })

  const approvedClaims = await prisma.expenseClaim.count({
    where: {
      ...baseWhere,
      status: 'APPROVED'
    }
  })

  // Audit trail completeness
  const claimsWithCompleteAudit = await prisma.expenseClaim.count({
    where: {
      ...baseWhere,
      approvals: { some: {} }
    }
  })

  return {
    overview: {
      totalClaims,
      complianceScore: totalClaims > 0 ? Math.round(((totalClaims - claimsWithViolations) / totalClaims) * 100) : 100
    },
    policyCompliance: {
      violationRate: totalClaims > 0 ? Math.round((claimsWithViolations / totalClaims) * 100) : 0,
      claimsWithViolations,
      totalClaims
    },
    receiptCompliance: {
      complianceRate: claimsRequiringReceipts > 0 ? Math.round((claimsWithReceipts / claimsRequiringReceipts) * 100) : 100,
      claimsWithReceipts,
      claimsRequiringReceipts
    },
    approvalCompliance: {
      approvalRate: claimsRequiringApproval > 0 ? Math.round((approvedClaims / claimsRequiringApproval) * 100) : 100,
      approvedClaims,
      claimsRequiringApproval
    },
    auditCompliance: {
      auditTrailCompleteness: totalClaims > 0 ? Math.round((claimsWithCompleteAudit / totalClaims) * 100) : 100,
      claimsWithCompleteAudit,
      totalClaims
    }
  }
}

async function generateTrendsReport(baseWhere: any, startDate: Date, endDate: Date) {
  // Get monthly data for the period
  const monthlyData = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('month', expense_date) as month,
      status,
      COUNT(*) as count,
      SUM(amount) as amount
    FROM expense_claims 
    WHERE expense_date >= ${startDate} AND expense_date <= ${endDate}
    GROUP BY DATE_TRUNC('month', expense_date), status
    ORDER BY month, status
  `

  // Calculate growth rates
  const currentPeriodTotal = await prisma.expenseClaim.aggregate({
    where: baseWhere,
    _sum: { amount: true },
    _count: { id: true }
  })

  // Previous period for comparison
  const periodDiff = endDate.getTime() - startDate.getTime()
  const prevStartDate = new Date(startDate.getTime() - periodDiff)
  const prevEndDate = new Date(endDate.getTime() - periodDiff)

  const previousPeriodTotal = await prisma.expenseClaim.aggregate({
    where: {
      ...baseWhere,
      expenseDate: {
        gte: prevStartDate,
        lte: prevEndDate
      }
    },
    _sum: { amount: true },
    _count: { id: true }
  })

  const amountGrowth = previousPeriodTotal._sum.amount?.toNumber() 
    ? ((currentPeriodTotal._sum.amount?.toNumber() || 0) - previousPeriodTotal._sum.amount.toNumber()) / previousPeriodTotal._sum.amount.toNumber() * 100
    : 0

  const countGrowth = previousPeriodTotal._count.id 
    ? ((currentPeriodTotal._count.id - previousPeriodTotal._count.id) / previousPeriodTotal._count.id) * 100
    : 0

  return {
    monthlyTrends: monthlyData,
    growthMetrics: {
      amountGrowth: Math.round(amountGrowth * 100) / 100,
      countGrowth: Math.round(countGrowth * 100) / 100,
      currentPeriod: {
        totalAmount: currentPeriodTotal._sum.amount?.toNumber() || 0,
        totalCount: currentPeriodTotal._count.id
      },
      previousPeriod: {
        totalAmount: previousPeriodTotal._sum.amount?.toNumber() || 0,
        totalCount: previousPeriodTotal._count.id
      }
    }
  }
}

async function getMostCommonCategory(baseWhere: any) {
  const categoryStats = await prisma.expenseClaim.groupBy({
    by: ['categoryId'],
    where: baseWhere,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 1
  })

  if (categoryStats.length === 0) return null

  const category = await prisma.expenseCategory.findUnique({
    where: { id: categoryStats[0].categoryId },
    select: { name: true }
  })

  return {
    categoryName: category?.name || 'Unknown',
    count: categoryStats[0]._count.id
  }
}

async function getApprovalRate(baseWhere: any) {
  const totalClaims = await prisma.expenseClaim.count({ where: baseWhere })
  const approvedClaims = await prisma.expenseClaim.count({
    where: {
      ...baseWhere,
      status: 'APPROVED'
    }
  })

  return totalClaims > 0 ? Math.round((approvedClaims / totalClaims) * 100) : 0
}
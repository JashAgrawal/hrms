import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reportsQuerySchema = z.object({
  reportType: z.enum([
    'SUMMARY',
    'DETAILED',
    'EMPLOYEE_WISE',
    'CATEGORY_WISE',
    'BATCH_WISE',
    'PAYMENT_SUMMARY',
    'COMPLIANCE'
  ]),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  employeeIds: z.string().optional().transform(str => str ? str.split(',') : undefined),
  departmentIds: z.string().optional().transform(str => str ? str.split(',') : undefined),
  categoryIds: z.string().optional().transform(str => str ? str.split(',') : undefined),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE']).optional(),
  format: z.enum(['JSON', 'CSV', 'PDF']).default('JSON'),
  includeDetails: z.boolean().default(true)
})

// GET /api/expenses/reimbursement/reports - Generate reimbursement reports
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

    let reportData: any

    switch (query.reportType) {
      case 'SUMMARY':
        reportData = await generateSummaryReport(query, user)
        break
      case 'DETAILED':
        reportData = await generateDetailedReport(query, user)
        break
      case 'EMPLOYEE_WISE':
        reportData = await generateEmployeeWiseReport(query, user)
        break
      case 'CATEGORY_WISE':
        reportData = await generateCategoryWiseReport(query, user)
        break
      case 'BATCH_WISE':
        reportData = await generateBatchWiseReport(query, user)
        break
      case 'PAYMENT_SUMMARY':
        reportData = await generatePaymentSummaryReport(query, user)
        break
      case 'COMPLIANCE':
        reportData = await generateComplianceReport(query, user)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        )
    }

    // Format response based on requested format
    if (query.format === 'CSV') {
      const csv = convertToCSV(reportData)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="reimbursement_${query.reportType.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    return NextResponse.json({
      reportType: query.reportType,
      generatedAt: new Date().toISOString(),
      parameters: {
        startDate: query.startDate,
        endDate: query.endDate,
        filters: {
          employees: query.employeeIds?.length || 0,
          departments: query.departmentIds?.length || 0,
          categories: query.categoryIds?.length || 0,
          status: query.status,
          paymentMethod: query.paymentMethod
        }
      },
      data: reportData
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error generating reimbursement report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Generate summary report
async function generateSummaryReport(query: any, user: any) {
  const whereClause = buildWhereClause(query, user)

  // Get overall statistics
  const totalStats = await prisma.expenseClaim.aggregate({
    where: {
      ...whereClause,
      reimbursedAt: {
        gte: query.startDate,
        lte: query.endDate
      }
    },
    _count: { id: true },
    _sum: { reimbursementAmount: true }
  })

  // Get pending statistics
  const pendingStats = await prisma.expenseClaim.aggregate({
    where: {
      ...whereClause,
      status: 'APPROVED',
      isReimbursable: true,
      reimbursedAt: null
    },
    _count: { id: true },
    _sum: { amount: true }
  })

  // Get monthly breakdown
  const monthlyBreakdown = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('month', reimbursed_at) as month,
      COUNT(*) as claim_count,
      SUM(reimbursement_amount) as total_amount,
      AVG(reimbursement_amount) as avg_amount
    FROM expense_claims 
    WHERE reimbursed_at >= ${query.startDate}
      AND reimbursed_at <= ${query.endDate}
      AND status = 'REIMBURSED'
    GROUP BY DATE_TRUNC('month', reimbursed_at)
    ORDER BY month DESC
  `

  // Get payment method breakdown
  const paymentMethodStats = await prisma.reimbursementBatch.groupBy({
    by: ['paymentMethod'],
    where: {
      processedAt: {
        gte: query.startDate,
        lte: query.endDate
      },
      status: 'COMPLETED'
    },
    _count: { id: true },
    _sum: { totalAmount: true }
  })

  return {
    summary: {
      totalReimbursed: totalStats._sum.reimbursementAmount?.toNumber() || 0,
      totalClaims: totalStats._count.id,
      averageAmount: totalStats._count.id > 0 ? 
        (totalStats._sum.reimbursementAmount?.toNumber() || 0) / totalStats._count.id : 0,
      pendingAmount: pendingStats._sum.amount?.toNumber() || 0,
      pendingClaims: pendingStats._count.id
    },
    monthlyBreakdown: (monthlyBreakdown as any[]).map((row: any) => ({
      month: row.month,
      claimCount: Number(row.claim_count),
      totalAmount: Number(row.total_amount),
      avgAmount: Number(row.avg_amount)
    })),
    paymentMethodBreakdown: paymentMethodStats.map(stat => ({
      paymentMethod: stat.paymentMethod,
      batchCount: stat._count.id,
      totalAmount: stat._sum.totalAmount?.toNumber() || 0
    }))
  }
}

// Generate detailed report
async function generateDetailedReport(query: any, user: any) {
  const whereClause = buildWhereClause(query, user)

  const claims = await prisma.expenseClaim.findMany({
    where: {
      ...whereClause,
      reimbursedAt: {
        gte: query.startDate,
        lte: query.endDate
      }
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          email: true,
          department: {
            select: { name: true }
          }
        }
      },
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
          referenceNumber: true,
          processedAt: true
        }
      }
    },
    orderBy: { reimbursedAt: 'desc' }
  })

  return {
    totalRecords: claims.length,
    totalAmount: claims.reduce((sum, claim) => sum + (claim.reimbursementAmount?.toNumber() || 0), 0),
    claims: claims.map(claim => ({
      id: claim.id,
      title: claim.title,
      description: claim.description,
      amount: claim.amount.toNumber(),
      reimbursementAmount: claim.reimbursementAmount?.toNumber() || 0,
      submittedAt: claim.createdAt,
      approvedAt: claim.approvedAt,
      reimbursedAt: claim.reimbursedAt,
      employee: {
        name: `${claim.employee.firstName} ${claim.employee.lastName}`,
        code: claim.employee.employeeCode,
        email: claim.employee.email,
        department: claim.employee.department?.name
      },
      category: {
        name: claim.category?.name,
        code: claim.category?.code
      },
      batch: claim.reimbursementBatch ? {
        batchId: claim.reimbursementBatch.batchId,
        paymentMethod: claim.reimbursementBatch.paymentMethod,
        referenceNumber: claim.reimbursementBatch.referenceNumber,
        processedAt: claim.reimbursementBatch.processedAt
      } : null,
      processingTime: claim.approvedAt && claim.reimbursedAt ? 
        Math.ceil((claim.reimbursedAt.getTime() - claim.approvedAt.getTime()) / (1000 * 60 * 60 * 24)) : null
    }))
  }
}

// Generate employee-wise report
async function generateEmployeeWiseReport(query: any, user: any) {
  const whereClause = buildWhereClause(query, user)

  const employeeStats = await prisma.expenseClaim.groupBy({
    by: ['employeeId'],
    where: {
      ...whereClause,
      reimbursedAt: {
        gte: query.startDate,
        lte: query.endDate
      }
    },
    _count: { id: true },
    _sum: { reimbursementAmount: true },
    _avg: { reimbursementAmount: true },
    _max: { reimbursementAmount: true }
  })

  // Get employee details
  const employeeIds = employeeStats.map(stat => stat.employeeId)
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      email: true,
      department: {
        select: { name: true }
      }
    }
  })

  const employeeMap = employees.reduce((acc, emp) => {
    acc[emp.id] = emp
    return acc
  }, {} as Record<string, any>)

  return {
    totalEmployees: employeeStats.length,
    employeeStats: employeeStats.map(stat => {
      const employee = employeeMap[stat.employeeId]
      return {
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          code: employee.employeeCode,
          email: employee.email,
          department: employee.department?.name
        },
        statistics: {
          totalClaims: stat._count.id,
          totalAmount: stat._sum.reimbursementAmount?.toNumber() || 0,
          averageAmount: stat._avg.reimbursementAmount?.toNumber() || 0,
          maxAmount: stat._max.reimbursementAmount?.toNumber() || 0
        }
      }
    }).sort((a, b) => b.statistics.totalAmount - a.statistics.totalAmount)
  }
}

// Generate category-wise report
async function generateCategoryWiseReport(query: any, user: any) {
  const whereClause = buildWhereClause(query, user)

  const categoryStats = await prisma.expenseClaim.groupBy({
    by: ['categoryId'],
    where: {
      ...whereClause,
      reimbursedAt: {
        gte: query.startDate,
        lte: query.endDate
      }
    },
    _count: { id: true },
    _sum: { reimbursementAmount: true },
    _avg: { reimbursementAmount: true }
  })

  // Get category details
  const categoryIds = categoryStats.map(stat => stat.categoryId).filter(Boolean)
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds } },
    select: {
      id: true,
      name: true,
      code: true,
      description: true
    }
  })

  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat
    return acc
  }, {} as Record<string, any>)

  return {
    totalCategories: categoryStats.length,
    categoryStats: categoryStats.map(stat => {
      const category = categoryMap[stat.categoryId || '']
      return {
        category: {
          id: category?.id,
          name: category?.name || 'Uncategorized',
          code: category?.code,
          description: category?.description
        },
        statistics: {
          totalClaims: stat._count.id,
          totalAmount: stat._sum.reimbursementAmount?.toNumber() || 0,
          averageAmount: stat._avg.reimbursementAmount?.toNumber() || 0,
          percentage: 0 // Will be calculated after getting total
        }
      }
    }).sort((a, b) => b.statistics.totalAmount - a.statistics.totalAmount)
  }
}

// Generate batch-wise report
async function generateBatchWiseReport(query: any, user: any) {
  const batches = await prisma.reimbursementBatch.findMany({
    where: {
      processedAt: {
        gte: query.startDate,
        lte: query.endDate
      },
      ...(query.status && { status: query.status }),
      ...(query.paymentMethod && { paymentMethod: query.paymentMethod })
    },
    include: {
      expenseClaims: {
        select: {
          id: true,
          amount: true,
          reimbursementAmount: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeCode: true
            }
          }
        }
      }
    },
    orderBy: { processedAt: 'desc' }
  })

  return {
    totalBatches: batches.length,
    batches: batches.map(batch => ({
      id: batch.id,
      batchId: batch.batchId,
      status: batch.status,
      paymentMethod: batch.paymentMethod,
      referenceNumber: batch.referenceNumber,
      totalAmount: batch.totalAmount.toNumber(),
      totalClaims: batch.totalClaims,
      processedAt: batch.processedAt,
      completedAt: batch.completedAt,
      failedAt: batch.failedAt,
      failureReason: batch.failureReason,
      claims: batch.expenseClaims.map(claim => ({
        id: claim.id,
        amount: claim.amount.toNumber(),
        reimbursementAmount: claim.reimbursementAmount?.toNumber() || 0,
        employeeName: `${claim.employee.firstName} ${claim.employee.lastName}`,
        employeeCode: claim.employee.employeeCode
      }))
    }))
  }
}

// Generate payment summary report
async function generatePaymentSummaryReport(query: any, user: any) {
  // Get unique employees who received payments
  const employeePayments = await prisma.$queryRaw`
    SELECT 
      e.id,
      e.first_name,
      e.last_name,
      e.employee_code,
      e.email,
      e.bank_account_number,
      e.bank_ifsc,
      e.bank_name,
      COUNT(ec.id) as total_claims,
      SUM(ec.reimbursement_amount) as total_amount,
      MIN(ec.reimbursed_at) as first_payment,
      MAX(ec.reimbursed_at) as last_payment
    FROM employees e
    INNER JOIN expense_claims ec ON e.id = ec.employee_id
    WHERE ec.reimbursed_at >= ${query.startDate}
      AND ec.reimbursed_at <= ${query.endDate}
      AND ec.status = 'REIMBURSED'
    GROUP BY e.id, e.first_name, e.last_name, e.employee_code, e.email, 
             e.bank_account_number, e.bank_ifsc, e.bank_name
    ORDER BY total_amount DESC
  `

  return {
    totalEmployees: (employeePayments as any[]).length,
    totalAmount: (employeePayments as any[]).reduce((sum: number, emp: any) => sum + Number(emp.total_amount), 0),
    totalClaims: (employeePayments as any[]).reduce((sum: number, emp: any) => sum + Number(emp.total_claims), 0),
    employeePayments: (employeePayments as any[]).map((emp: any) => ({
      employee: {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        code: emp.employee_code,
        email: emp.email
      },
      bankDetails: {
        accountNumber: emp.bank_account_number ? 
          emp.bank_account_number.replace(/\d(?=\d{4})/g, '*') : null,
        ifscCode: emp.bank_ifsc,
        bankName: emp.bank_name
      },
      paymentSummary: {
        totalClaims: Number(emp.total_claims),
        totalAmount: Number(emp.total_amount),
        firstPayment: emp.first_payment,
        lastPayment: emp.last_payment
      }
    }))
  }
}

// Generate compliance report
async function generateComplianceReport(query: any, user: any) {
  // TDS calculations and compliance data
  const tdsThreshold = 50000 // Annual TDS threshold

  const employeeTDS = await prisma.$queryRaw`
    SELECT 
      e.id,
      e.first_name,
      e.last_name,
      e.employee_code,
      e.pan_number,
      SUM(ec.reimbursement_amount) as annual_reimbursement,
      COUNT(ec.id) as total_claims
    FROM employees e
    INNER JOIN expense_claims ec ON e.id = ec.employee_id
    WHERE EXTRACT(YEAR FROM ec.reimbursed_at) = EXTRACT(YEAR FROM ${query.startDate})
      AND ec.status = 'REIMBURSED'
    GROUP BY e.id, e.first_name, e.last_name, e.employee_code, e.pan_number
    HAVING SUM(ec.reimbursement_amount) > ${tdsThreshold}
    ORDER BY annual_reimbursement DESC
  `

  // Audit trail for compliance
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ['REIMBURSEMENT_PROCESSED', 'REIMBURSEMENT_BATCH_STATUS_UPDATED']
      },
      timestamp: {
        gte: query.startDate,
        lte: query.endDate
      }
    },
    include: {
      user: {
        select: {
          email: true,
          role: true
        }
      }
    },
    orderBy: { timestamp: 'desc' }
  })

  return {
    tdsCompliance: {
      threshold: tdsThreshold,
      employeesAboveThreshold: Array.isArray(employeeTDS) ? employeeTDS.length : 0,
      employees: Array.isArray(employeeTDS) ? employeeTDS.map((emp: any) => ({
        employee: {
          name: `${emp.first_name} ${emp.last_name}`,
          code: emp.employee_code,
          panNumber: emp.pan_number
        },
        annualReimbursement: Number(emp.annual_reimbursement),
        totalClaims: Number(emp.total_claims),
        tdsApplicable: Number(emp.annual_reimbursement) > tdsThreshold
      })) : []
    },
    auditTrail: {
      totalActions: auditLogs.length,
      actions: auditLogs.map(log => ({
        action: log.action,
        performedBy: log.user?.email,
        userRole: log.user?.role,
        timestamp: log.timestamp,
        details: log.details
      }))
    }
  }
}

// Helper function to build where clause based on filters
function buildWhereClause(query: any, user: any) {
  const where: any = {}

  // Role-based filtering
  if (user.role === 'MANAGER' && user.employee) {
    // Managers can only see their team's data
    where.employee = {
      managerId: user.employee.id
    }
  }

  // Apply filters
  if (query.employeeIds) {
    where.employeeId = { in: query.employeeIds }
  }

  if (query.departmentIds) {
    where.employee = {
      ...where.employee,
      departmentId: { in: query.departmentIds }
    }
  }

  if (query.categoryIds) {
    where.categoryId = { in: query.categoryIds }
  }

  if (query.status) {
    if (query.status === 'PENDING') {
      where.status = 'APPROVED'
      where.isReimbursable = true
      where.reimbursedAt = null
    } else {
      where.reimbursementBatch = {
        status: query.status
      }
    }
  }

  return where
}

// Helper function to convert data to CSV
function convertToCSV(data: any): string {
  if (!data || typeof data !== 'object') {
    return ''
  }

  // Handle different report types
  if (data.claims) {
    // Detailed report
    const headers = [
      'Claim ID', 'Title', 'Employee Name', 'Employee Code', 'Department',
      'Category', 'Amount', 'Reimbursement Amount', 'Submitted At',
      'Approved At', 'Reimbursed At', 'Batch ID', 'Payment Method',
      'Reference Number', 'Processing Time (Days)'
    ]

    const rows = data.claims.map((claim: any) => [
      claim.id,
      claim.title,
      claim.employee.name,
      claim.employee.code,
      claim.employee.department || '',
      claim.category?.name || '',
      claim.amount,
      claim.reimbursementAmount,
      claim.submittedAt,
      claim.approvedAt || '',
      claim.reimbursedAt || '',
      claim.batch?.batchId || '',
      claim.batch?.paymentMethod || '',
      claim.batch?.referenceNumber || '',
      claim.processingTime || ''
    ])

    return [headers, ...rows].map(row =>
      row.map((cell: any) => `"${cell}"`).join(',')
    ).join('\n')
  }

  // Default JSON to CSV conversion for other report types
  return JSON.stringify(data, null, 2)
}
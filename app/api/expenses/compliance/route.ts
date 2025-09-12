import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { startOfMonth, endOfMonth } from 'date-fns'

const complianceQuerySchema = z.object({
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  departmentId: z.string().optional(),
  employeeId: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const canViewCompliance = ['ADMIN', 'FINANCE', 'HR', 'MANAGER'].includes(user?.role || '')
    
    if (!canViewCompliance) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = complianceQuerySchema.parse(Object.fromEntries(searchParams))

    // Default to current month if no date range provided
    const startDate = query.startDate || startOfMonth(new Date())
    const endDate = query.endDate || endOfMonth(new Date())

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

    if (query.departmentId) {
      baseWhere.employee = {
        departmentId: query.departmentId
      }
    }

    // Get overall compliance metrics
    const totalClaims = await prisma.expenseClaim.count({ where: baseWhere })

    // Policy violations analysis
    const claimsWithViolations = await prisma.expenseClaim.findMany({
      where: {
        ...baseWhere,
        policyViolations: { not: null }
      },
      select: {
        id: true,
        amount: true,
        policyViolations: true
      }
    })

    const violationStats = claimsWithViolations.reduce((acc, claim) => {
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

    const policyViolations = Object.entries(violationStats).map(([rule, stats]) => ({
      rule,
      count: stats.count,
      totalAmount: stats.totalAmount
    }))

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

    const claimsWithCompleteApprovals = await prisma.expenseClaim.count({
      where: {
        ...baseWhere,
        category: { requiresApproval: true },
        status: { in: ['APPROVED', 'REIMBURSED'] }
      }
    })

    // GPS compliance (for categories requiring GPS)
    const claimsRequiringGPS = await prisma.expenseClaim.count({
      where: {
        ...baseWhere,
        category: {
          policyRules: {
            some: {
              ruleType: 'GPS_REQUIRED',
              isActive: true
            }
          }
        }
      }
    })

    const claimsWithGPS = await prisma.expenseClaim.count({
      where: {
        ...baseWhere,
        category: {
          policyRules: {
            some: {
              ruleType: 'GPS_REQUIRED',
              isActive: true
            }
          }
        },
        location: { not: null }
      }
    })

    // Timeliness compliance (claims submitted within policy timeframe)
    const timelySubmissions = await prisma.expenseClaim.count({
      where: {
        ...baseWhere,
        // Assuming claims should be submitted within 30 days of expense date
        createdAt: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }
    })

    // Amount compliance (within category limits)
    const claimsExceedingLimits = await prisma.expenseClaim.count({
      where: {
        ...baseWhere,
        OR: [
          {
            category: {
              maxAmount: { not: null }
            },
            amount: {
              gt: prisma.expenseCategory.fields.maxAmount
            }
          }
        ]
      }
    })

    // Calculate compliance scores
    const compliantClaims = totalClaims - claimsWithViolations.length
    const complianceScore = totalClaims > 0 ? Math.round((compliantClaims / totalClaims) * 100) : 100

    const receiptComplianceRate = claimsRequiringReceipts > 0 
      ? Math.round((claimsWithReceipts / claimsRequiringReceipts) * 100) 
      : 100

    const approvalComplianceRate = claimsRequiringApproval > 0 
      ? Math.round((claimsWithCompleteApprovals / claimsRequiringApproval) * 100) 
      : 100

    const gpsComplianceRate = claimsRequiringGPS > 0 
      ? Math.round((claimsWithGPS / claimsRequiringGPS) * 100) 
      : 100

    const timelinessRate = totalClaims > 0 
      ? Math.round((timelySubmissions / totalClaims) * 100) 
      : 100

    const amountComplianceRate = totalClaims > 0 
      ? Math.round(((totalClaims - claimsExceedingLimits) / totalClaims) * 100) 
      : 100

    // Department-wise compliance (if not filtered by department)
    let departmentCompliance: any[] = []
    if (!query.departmentId) {
      const departments = await prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      })

      departmentCompliance = await Promise.all(
        departments.map(async (dept) => {
          const deptClaims = await prisma.expenseClaim.count({
            where: {
              ...baseWhere,
              employee: { departmentId: dept.id }
            }
          })

          const deptViolations = await prisma.expenseClaim.count({
            where: {
              ...baseWhere,
              employee: { departmentId: dept.id },
              policyViolations: { not: null }
            }
          })

          const deptCompliance = deptClaims > 0 
            ? Math.round(((deptClaims - deptViolations) / deptClaims) * 100) 
            : 100

          return {
            departmentId: dept.id,
            departmentName: dept.name,
            totalClaims: deptClaims,
            violationClaims: deptViolations,
            complianceScore: deptCompliance
          }
        })
      )
    }

    // Category-wise compliance
    const categoryCompliance = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            expenseClaims: {
              where: baseWhere
            }
          }
        }
      }
    })

    const categoryComplianceWithViolations = await Promise.all(
      categoryCompliance.map(async (category) => {
        const categoryViolations = await prisma.expenseClaim.count({
          where: {
            ...baseWhere,
            categoryId: category.id,
            policyViolations: { not: null }
          }
        })

        const categoryTotal = category._count.expenseClaims
        const categoryComplianceScore = categoryTotal > 0 
          ? Math.round(((categoryTotal - categoryViolations) / categoryTotal) * 100) 
          : 100

        return {
          categoryId: category.id,
          categoryName: category.name,
          totalClaims: categoryTotal,
          violationClaims: categoryViolations,
          complianceScore: categoryComplianceScore
        }
      })
    )

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      totalClaims,
      compliantClaims,
      violationClaims: claimsWithViolations.length,
      complianceScore,
      policyViolations,
      receiptCompliance: {
        required: claimsRequiringReceipts,
        provided: claimsWithReceipts,
        rate: receiptComplianceRate
      },
      approvalCompliance: {
        required: claimsRequiringApproval,
        completed: claimsWithCompleteApprovals,
        rate: approvalComplianceRate
      },
      gpsCompliance: {
        required: claimsRequiringGPS,
        provided: claimsWithGPS,
        rate: gpsComplianceRate
      },
      timelinessCompliance: {
        total: totalClaims,
        timely: timelySubmissions,
        rate: timelinessRate
      },
      amountCompliance: {
        total: totalClaims,
        withinLimits: totalClaims - claimsExceedingLimits,
        rate: amountComplianceRate
      },
      departmentCompliance,
      categoryCompliance: categoryComplianceWithViolations,
      recommendations: generateComplianceRecommendations({
        complianceScore,
        receiptComplianceRate,
        approvalComplianceRate,
        gpsComplianceRate,
        timelinessRate,
        amountComplianceRate,
        policyViolations
      })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching compliance data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateComplianceRecommendations(metrics: {
  complianceScore: number
  receiptComplianceRate: number
  approvalComplianceRate: number
  gpsComplianceRate: number
  timelinessRate: number
  amountComplianceRate: number
  policyViolations: any[]
}) {
  const recommendations = []

  if (metrics.complianceScore < 80) {
    recommendations.push({
      type: 'CRITICAL',
      title: 'Low Overall Compliance',
      description: 'Overall compliance score is below 80%. Immediate action required.',
      actions: [
        'Review and update expense policies',
        'Provide additional training to employees',
        'Implement stricter approval workflows'
      ]
    })
  }

  if (metrics.receiptComplianceRate < 90) {
    recommendations.push({
      type: 'WARNING',
      title: 'Receipt Compliance Issue',
      description: 'Many expense claims are missing required receipts.',
      actions: [
        'Send reminders about receipt requirements',
        'Implement automatic receipt validation',
        'Provide mobile receipt capture tools'
      ]
    })
  }

  if (metrics.approvalComplianceRate < 95) {
    recommendations.push({
      type: 'WARNING',
      title: 'Approval Process Delays',
      description: 'Approval process is not completing efficiently.',
      actions: [
        'Review approval hierarchy',
        'Set up automatic escalation',
        'Send reminder notifications to approvers'
      ]
    })
  }

  if (metrics.gpsComplianceRate < 85) {
    recommendations.push({
      type: 'INFO',
      title: 'GPS Location Compliance',
      description: 'Some claims requiring GPS location are missing location data.',
      actions: [
        'Educate employees about GPS requirements',
        'Improve mobile app GPS capture',
        'Allow manual location entry with justification'
      ]
    })
  }

  if (metrics.timelinessRate < 90) {
    recommendations.push({
      type: 'WARNING',
      title: 'Timely Submission Issues',
      description: 'Employees are not submitting claims within the required timeframe.',
      actions: [
        'Send regular reminders about submission deadlines',
        'Implement automatic expense capture from corporate cards',
        'Provide easier submission methods'
      ]
    })
  }

  if (metrics.policyViolations.length > 0) {
    const topViolation = metrics.policyViolations.reduce((prev, current) => 
      prev.count > current.count ? prev : current
    )

    recommendations.push({
      type: 'INFO',
      title: 'Common Policy Violations',
      description: `Most common violation: ${topViolation.rule} (${topViolation.count} instances)`,
      actions: [
        'Review policy rules for clarity',
        'Provide targeted training on common violations',
        'Consider policy adjustments if violations are reasonable'
      ]
    })
  }

  return recommendations
}
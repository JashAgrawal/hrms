import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const canViewStats = ['ADMIN', 'FINANCE', 'HR'].includes(user?.role || '')
    
    if (!canViewStats) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get pending reimbursements (approved but not reimbursed)
    const pendingStats = await prisma.expenseClaim.aggregate({
      where: {
        status: 'APPROVED',
        isReimbursable: true,
        reimbursedAt: null
      },
      _count: { id: true },
      _sum: { amount: true }
    })

    // Get processing reimbursements (in batches that are processing)
    const processingBatches = await prisma.reimbursementBatch.findMany({
      where: { status: 'PROCESSING' },
      select: {
        totalAmount: true,
        totalClaims: true
      }
    })

    const processingStats = processingBatches.reduce(
      (acc, batch) => ({
        amount: acc.amount + batch.totalAmount.toNumber(),
        claims: acc.claims + batch.totalClaims
      }),
      { amount: 0, claims: 0 }
    )

    // Get completed reimbursements (this month)
    const currentMonth = new Date()
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

    const completedStats = await prisma.expenseClaim.aggregate({
      where: {
        status: 'REIMBURSED',
        reimbursedAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      _count: { id: true },
      _sum: { reimbursementAmount: true }
    })

    // Calculate average processing time
    const recentReimbursements = await prisma.expenseClaim.findMany({
      where: {
        status: 'REIMBURSED',
        reimbursedAt: { not: null },
        approvedAt: { not: null }
      },
      select: {
        approvedAt: true,
        reimbursedAt: true
      },
      orderBy: { reimbursedAt: 'desc' },
      take: 100 // Last 100 reimbursements for average calculation
    })

    const avgProcessingTime = recentReimbursements.length > 0
      ? recentReimbursements.reduce((sum, claim) => {
          const processingTime = claim.reimbursedAt!.getTime() - claim.approvedAt!.getTime()
          return sum + (processingTime / (1000 * 60 * 60 * 24)) // Convert to days
        }, 0) / recentReimbursements.length
      : 0

    // Get monthly trends (last 6 months)
    const monthlyTrends = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', reimbursed_at) as month,
        COUNT(*) as reimbursed_count,
        SUM(reimbursement_amount) as reimbursed_amount
      FROM expense_claims 
      WHERE reimbursed_at >= ${new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)}
        AND status = 'REIMBURSED'
      GROUP BY DATE_TRUNC('month', reimbursed_at)
      ORDER BY month DESC
    `

    // Get top categories by reimbursement amount (this month)
    const topCategories = await prisma.expenseClaim.groupBy({
      by: ['categoryId'],
      where: {
        status: 'REIMBURSED',
        reimbursedAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      _count: { id: true },
      _sum: { reimbursementAmount: true },
      orderBy: { _sum: { reimbursementAmount: 'desc' } },
      take: 5
    })

    // Get category names
    const categoryIds = topCategories.map(cat => cat.categoryId)
    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true }
    })

    const categoryMap = categories.reduce((acc, cat) => {
      acc[cat.id] = cat.name
      return acc
    }, {} as Record<string, string>)

    const topCategoriesWithNames = topCategories.map(cat => ({
      categoryId: cat.categoryId,
      categoryName: categoryMap[cat.categoryId] || 'Unknown',
      count: cat._count.id,
      amount: cat._sum.reimbursementAmount?.toNumber() || 0
    }))

    return NextResponse.json({
      pendingAmount: pendingStats._sum.amount?.toNumber() || 0,
      pendingClaims: pendingStats._count.id,
      processingAmount: processingStats.amount,
      processingClaims: processingStats.claims,
      completedAmount: completedStats._sum.reimbursementAmount?.toNumber() || 0,
      completedClaims: completedStats._count.id,
      avgProcessingTime: Math.round(avgProcessingTime * 10) / 10, // Round to 1 decimal
      monthlyTrends,
      topCategories: topCategoriesWithNames,
      insights: {
        totalPendingValue: pendingStats._sum.amount?.toNumber() || 0,
        largestPendingClaim: await getLargestPendingClaim(),
        oldestPendingClaim: await getOldestPendingClaim(),
        reimbursementVelocity: await getReimbursementVelocity()
      }
    })
  } catch (error) {
    console.error('Error fetching reimbursement stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getLargestPendingClaim() {
  const largestClaim = await prisma.expenseClaim.findFirst({
    where: {
      status: 'APPROVED',
      isReimbursable: true,
      reimbursedAt: null
    },
    orderBy: { amount: 'desc' },
    select: {
      amount: true,
      title: true,
      employee: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  })

  return largestClaim ? {
    amount: largestClaim.amount.toNumber(),
    title: largestClaim.title,
    employeeName: `${largestClaim.employee.firstName} ${largestClaim.employee.lastName}`
  } : null
}

async function getOldestPendingClaim() {
  const oldestClaim = await prisma.expenseClaim.findFirst({
    where: {
      status: 'APPROVED',
      isReimbursable: true,
      reimbursedAt: null
    },
    orderBy: { approvedAt: 'asc' },
    select: {
      approvedAt: true,
      title: true,
      employee: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  })

  if (!oldestClaim) return null

  const daysPending = Math.floor(
    (Date.now() - oldestClaim.approvedAt!.getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    daysPending,
    title: oldestClaim.title,
    employeeName: `${oldestClaim.employee.firstName} ${oldestClaim.employee.lastName}`,
    approvedAt: oldestClaim.approvedAt
  }
}

async function getReimbursementVelocity() {
  // Calculate reimbursements processed in the last 7 days vs previous 7 days
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const previous7Days = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const recent = await prisma.expenseClaim.count({
    where: {
      status: 'REIMBURSED',
      reimbursedAt: { gte: last7Days }
    }
  })

  const previous = await prisma.expenseClaim.count({
    where: {
      status: 'REIMBURSED',
      reimbursedAt: {
        gte: previous7Days,
        lt: last7Days
      }
    }
  })

  const velocityChange = previous > 0 ? ((recent - previous) / previous) * 100 : 0

  return {
    recentCount: recent,
    previousCount: previous,
    changePercent: Math.round(velocityChange * 10) / 10
  }
}
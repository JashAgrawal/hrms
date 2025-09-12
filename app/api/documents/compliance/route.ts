import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin/HR can view compliance reports
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'overview'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build date filter
    const dateFilter: any = {}
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom)
    }
    if (dateTo) {
      dateFilter.lte = new Date(dateTo)
    }

    switch (reportType) {
      case 'overview':
        return await generateOverviewReport(dateFilter)
      case 'access':
        return await generateAccessReport(dateFilter)
      case 'expiry':
        return await generateExpiryReport(dateFilter)
      case 'security':
        return await generateSecurityReport(dateFilter)
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error generating compliance report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function generateOverviewReport(dateFilter: any) {
  const [
    totalDocuments,
    activeDocuments,
    expiredDocuments,
    pendingApprovals,
    documentsByCategory,
    documentsByStatus,
    recentUploads,
    complianceRate
  ] = await Promise.all([
    // Total documents
    prisma.document.count(),
    
    // Active documents
    prisma.document.count({
      where: { status: 'ACTIVE', isActive: true }
    }),
    
    // Expired documents
    prisma.document.count({
      where: {
        expiryDate: { lt: new Date() },
        status: 'ACTIVE'
      }
    }),
    
    // Pending approvals
    prisma.document.count({
      where: { approvalStatus: 'PENDING' }
    }),
    
    // Documents by category
    prisma.document.groupBy({
      by: ['category'],
      _count: true,
      orderBy: { _count: { category: 'desc' } }
    }),
    
    // Documents by status
    prisma.document.groupBy({
      by: ['status'],
      _count: true
    }),
    
    // Recent uploads (last 30 days)
    prisma.document.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    
    // Calculate compliance rate
    calculateComplianceRate()
  ])

  return NextResponse.json({
    reportType: 'overview',
    generatedAt: new Date().toISOString(),
    summary: {
      totalDocuments,
      activeDocuments,
      expiredDocuments,
      pendingApprovals,
      recentUploads,
      complianceRate
    },
    breakdown: {
      byCategory: documentsByCategory,
      byStatus: documentsByStatus
    }
  })
}

async function generateAccessReport(dateFilter: any) {
  const whereClause = Object.keys(dateFilter).length > 0 
    ? { timestamp: dateFilter }
    : {}

  const [
    totalAccessEvents,
    uniqueUsers,
    failedAttempts,
    accessByAction,
    topAccessedDocuments,
    accessTrends
  ] = await Promise.all([
    // Total access events
    prisma.documentAccessLog.count({ where: whereClause }),
    
    // Unique users
    prisma.documentAccessLog.findMany({
      where: whereClause,
      select: { userId: true },
      distinct: ['userId']
    }).then(results => results.length),
    
    // Failed access attempts
    prisma.documentAccessLog.count({
      where: { ...whereClause, success: false }
    }),
    
    // Access by action
    prisma.documentAccessLog.groupBy({
      by: ['action'],
      where: whereClause,
      _count: true,
      orderBy: { _count: { action: 'desc' } }
    }),
    
    // Top accessed documents
    prisma.documentAccessLog.groupBy({
      by: ['documentId'],
      where: whereClause,
      _count: true,
      orderBy: { _count: { documentId: 'desc' } },
      take: 10
    }),
    
    // Access trends (daily for last 30 days)
    generateAccessTrends(dateFilter)
  ])

  return NextResponse.json({
    reportType: 'access',
    generatedAt: new Date().toISOString(),
    summary: {
      totalAccessEvents,
      uniqueUsers,
      failedAttempts,
      successRate: totalAccessEvents > 0 
        ? ((totalAccessEvents - failedAttempts) / totalAccessEvents * 100).toFixed(2)
        : 0
    },
    breakdown: {
      byAction: accessByAction,
      topDocuments: topAccessedDocuments,
      trends: accessTrends
    }
  })
}

async function generateExpiryReport(dateFilter: any) {
  const now = new Date()
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [
    expiredDocuments,
    expiringIn7Days,
    expiringIn30Days,
    documentsWithoutExpiry,
    expiryByCategory,
    criticalExpirations
  ] = await Promise.all([
    // Already expired
    prisma.document.findMany({
      where: {
        expiryDate: { lt: now },
        status: 'ACTIVE'
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { expiryDate: 'desc' }
    }),
    
    // Expiring in 7 days
    prisma.document.findMany({
      where: {
        expiryDate: {
          gte: now,
          lte: next7Days
        },
        status: 'ACTIVE'
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { expiryDate: 'asc' }
    }),
    
    // Expiring in 30 days
    prisma.document.count({
      where: {
        expiryDate: {
          gte: now,
          lte: next30Days
        },
        status: 'ACTIVE'
      }
    }),
    
    // Documents without expiry date
    prisma.document.count({
      where: {
        expiryDate: null,
        status: 'ACTIVE'
      }
    }),
    
    // Expiry by category
    prisma.document.groupBy({
      by: ['category'],
      where: {
        expiryDate: { lt: next30Days },
        status: 'ACTIVE'
      },
      _count: true
    }),
    
    // Critical expirations (required documents)
    prisma.document.findMany({
      where: {
        expiryDate: { lte: next7Days },
        isRequired: true,
        status: 'ACTIVE'
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })
  ])

  return NextResponse.json({
    reportType: 'expiry',
    generatedAt: new Date().toISOString(),
    summary: {
      expiredCount: expiredDocuments.length,
      expiringIn7Days: expiringIn7Days.length,
      expiringIn30Days,
      documentsWithoutExpiry,
      criticalExpirations: criticalExpirations.length
    },
    details: {
      expired: expiredDocuments,
      expiringIn7Days,
      criticalExpirations,
      byCategory: expiryByCategory
    }
  })
}

async function generateSecurityReport(dateFilter: any) {
  const whereClause = Object.keys(dateFilter).length > 0 
    ? { timestamp: dateFilter }
    : {}

  const [
    securityEvents,
    failedAccess,
    suspiciousActivity,
    ipAddresses,
    userAgents,
    downloadActivity
  ] = await Promise.all([
    // Security-related events
    prisma.documentAccessLog.count({
      where: {
        ...whereClause,
        action: { in: ['DOWNLOAD', 'SHARE', 'DELETE'] }
      }
    }),
    
    // Failed access attempts
    prisma.documentAccessLog.findMany({
      where: { ...whereClause, success: false },
      include: {
        document: {
          select: {
            title: true,
            category: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 50
    }),
    
    // Suspicious activity (multiple failed attempts from same IP)
    prisma.$queryRaw`
      SELECT ip_address, COUNT(*) as attempt_count, MAX(timestamp) as last_attempt
      FROM document_access_logs 
      WHERE success = false 
      ${Object.keys(dateFilter).length > 0 ? 'AND timestamp >= $1 AND timestamp <= $2' : ''}
      GROUP BY ip_address 
      HAVING COUNT(*) >= 5
      ORDER BY attempt_count DESC
    `,
    
    // Unique IP addresses
    prisma.documentAccessLog.findMany({
      where: whereClause,
      select: { ipAddress: true },
      distinct: ['ipAddress']
    }).then(results => results.filter(r => r.ipAddress).length),
    
    // User agents
    prisma.documentAccessLog.groupBy({
      by: ['userAgent'],
      where: whereClause,
      _count: true,
      orderBy: { _count: { userAgent: 'desc' } },
      take: 10
    }),
    
    // Download activity
    prisma.documentAccessLog.count({
      where: {
        ...whereClause,
        action: 'DOWNLOAD'
      }
    })
  ])

  return NextResponse.json({
    reportType: 'security',
    generatedAt: new Date().toISOString(),
    summary: {
      securityEvents,
      failedAccessAttempts: failedAccess.length,
      suspiciousIPs: Array.isArray(suspiciousActivity) ? suspiciousActivity.length : 0,
      uniqueIPAddresses: ipAddresses,
      downloadActivity
    },
    details: {
      failedAccess: failedAccess.slice(0, 20), // Limit for response size
      suspiciousActivity,
      topUserAgents: userAgents
    }
  })
}

async function calculateComplianceRate(): Promise<number> {
  const [totalRequired, compliantRequired] = await Promise.all([
    prisma.document.count({
      where: { isRequired: true, isActive: true }
    }),
    prisma.document.count({
      where: {
        isRequired: true,
        isActive: true,
        approvalStatus: 'APPROVED',
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: new Date() } }
        ]
      }
    })
  ])

  return totalRequired > 0 ? (compliantRequired / totalRequired * 100) : 100
}

async function generateAccessTrends(dateFilter: any): Promise<any[]> {
  // Generate daily access trends for the last 30 days
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

  const trends = []
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(d)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(d)
    dayEnd.setHours(23, 59, 59, 999)

    const count = await prisma.documentAccessLog.count({
      where: {
        timestamp: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    })

    trends.push({
      date: dayStart.toISOString().split('T')[0],
      accessCount: count
    })
  }

  return trends
}
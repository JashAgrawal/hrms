import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const auditTrailQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
  resourceId: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().optional(),
  resource: z.string().optional(),
  success: z.string().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined).optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional()
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

    const canViewAuditTrail = ['ADMIN', 'FINANCE', 'HR'].includes(user?.role || '')
    
    if (!canViewAuditTrail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = auditTrailQuerySchema.parse(Object.fromEntries(searchParams))

    // Build filter conditions
    const where: any = {
      resource: { in: ['EXPENSE_CLAIM', 'EXPENSE_APPROVAL', 'REIMBURSEMENT_BATCH'] }
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId
    }

    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' }
    }

    if (query.userId) {
      where.userId = query.userId
    }

    if (query.resource) {
      where.resource = query.resource
    }

    if (query.success !== undefined) {
      where.success = query.success
    }

    if (query.startDate && query.endDate) {
      where.timestamp = {
        gte: query.startDate,
        lte: query.endDate
      }
    }

    // Get total count
    const totalCount = await prisma.auditLog.count({ where })

    // Get audit entries
    const auditEntries = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    })

    // Transform data for response
    const transformedEntries = auditEntries.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      userId: entry.userId,
      userName: entry.user?.name || entry.userName || 'Unknown User',
      userRole: entry.user?.role || 'Unknown',
      userEmail: entry.user?.email,
      details: entry.details,
      oldValues: entry.oldValues,
      newValues: entry.newValues,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      success: entry.success,
      errorMessage: entry.errorMessage
    }))

    // Get summary statistics
    const actionStats = await prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: { id: true }
    })

    const userStats = await prisma.auditLog.groupBy({
      by: ['userId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    })

    return NextResponse.json({
      entries: transformedEntries,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / query.limit)
      },
      statistics: {
        totalEntries: totalCount,
        actionBreakdown: actionStats.map(stat => ({
          action: stat.action,
          count: stat._count.id
        })),
        topUsers: userStats.map(stat => ({
          userId: stat.userId,
          count: stat._count.id
        }))
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching audit trail:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
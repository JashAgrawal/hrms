import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subMonths, format, startOfMonth, endOfMonth, addDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Only HR and admins can see analytics
    if (!['HR', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const now = new Date()
    const sixMonthsAgo = subMonths(now, 6)
    const currentYear = now.getFullYear()

    // Get total requests this year
    const totalRequests = await prisma.leaveRequest.count({
      where: {
        createdAt: {
          gte: new Date(currentYear, 0, 1),
          lte: new Date(currentYear, 11, 31)
        }
      }
    })

    // Calculate approval rate
    const approvedRequests = await prisma.leaveRequest.count({
      where: {
        status: 'APPROVED',
        createdAt: {
          gte: new Date(currentYear, 0, 1),
          lte: new Date(currentYear, 11, 31)
        }
      }
    })

    const approvalRate = totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0

    // Calculate average processing time
    const processedRequests = await prisma.leaveRequest.findMany({
      where: {
        status: { in: ['APPROVED', 'REJECTED'] },
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      include: {
        approvals: {
          where: {
            status: { in: ['APPROVED', 'REJECTED'] }
          },
          orderBy: {
            updatedAt: 'desc'
          },
          take: 1
        }
      }
    })

    let totalProcessingDays = 0
    let processedCount = 0

    processedRequests.forEach(request => {
      if (request.approvals.length > 0) {
        const processingTime = Math.ceil(
          (request.approvals[0].updatedAt.getTime() - request.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        )
        totalProcessingDays += processingTime
        processedCount++
      }
    })

    const averageProcessingTime = processedCount > 0 ? Math.round(totalProcessingDays / processedCount) : 0

    // Get most used leave type
    const leaveTypeUsage = await prisma.leaveRequest.groupBy({
      by: ['policyId'],
      where: {
        createdAt: {
          gte: new Date(currentYear, 0, 1)
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 1
    })

    let mostUsedLeaveType = {
      name: 'N/A',
      count: 0,
      percentage: 0
    }

    if (leaveTypeUsage.length > 0) {
      const policy = await prisma.leavePolicy.findUnique({
        where: { id: leaveTypeUsage[0].policyId }
      })
      
      if (policy) {
        mostUsedLeaveType = {
          name: policy.name,
          count: leaveTypeUsage[0]._count.id,
          percentage: totalRequests > 0 ? Math.round((leaveTypeUsage[0]._count.id / totalRequests) * 100) : 0
        }
      }
    }

    // Get monthly trend (last 6 months)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i)
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)

      const monthRequests = await prisma.leaveRequest.count({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      })

      const monthApproved = await prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      })

      monthlyTrend.push({
        month: format(monthDate, 'MMM yyyy'),
        requests: monthRequests,
        approved: monthApproved
      })
    }

    // Get department usage
    const departmentUsage = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        createdAt: {
          gte: new Date(currentYear, 0, 1)
        }
      },
      include: {
        employee: {
          include: {
            department: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    const deptUsageMap = new Map<string, number>()
    departmentUsage.forEach(request => {
      const deptName = request.employee.department?.name || 'No Department'
      deptUsageMap.set(deptName, (deptUsageMap.get(deptName) || 0) + Number(request.days))
    })

    const totalDaysUsed = Array.from(deptUsageMap.values()).reduce((sum, days) => sum + days, 0)
    const departmentUsageArray = Array.from(deptUsageMap.entries())
      .map(([department, usage]) => ({
        department,
        usage,
        percentage: totalDaysUsed > 0 ? Math.round((usage / totalDaysUsed) * 100) : 0
      }))
      .sort((a, b) => b.usage - a.usage)

    // Get upcoming leave peaks (next 30 days)
    const upcomingLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: {
          gte: now,
          lte: addDays(now, 30)
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    })

    // Group by date to find peaks
    const dateCountMap = new Map<string, number>()
    upcomingLeaves.forEach(leave => {
      const dateKey = format(leave.startDate, 'MMM dd, yyyy')
      dateCountMap.set(dateKey, (dateCountMap.get(dateKey) || 0) + 1)
    })

    const upcomingPeaks = Array.from(dateCountMap.entries())
      .filter(([_, count]) => count >= 3) // Consider 3+ employees as a peak
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const analytics = {
      totalRequests,
      approvalRate,
      averageProcessingTime,
      mostUsedLeaveType,
      monthlyTrend,
      departmentUsage: departmentUsageArray,
      upcomingPeaks
    }

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

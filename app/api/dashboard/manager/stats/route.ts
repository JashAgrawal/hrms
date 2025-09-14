import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/manager/stats - Get Manager dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const managerId = currentUser.employee.id
    const currentDate = new Date()
    const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())

    // Get team members (subordinates)
    const teamMembers = await prisma.employee.findMany({
      where: {
        reportingTo: managerId,
        status: 'ACTIVE'
      }
    })

    const teamSize = teamMembers.length
    const teamMemberIds = teamMembers.map(member => member.id)

    // Get present today count
    const presentToday = await prisma.attendanceRecord.count({
      where: {
        employeeId: { in: teamMemberIds },
        date: today,
        status: { in: ['PRESENT', 'LATE'] }
      }
    })

    // Get pending leave requests from team members
    const leaveRequests = await prisma.leaveRequest.count({
      where: {
        employeeId: { in: teamMemberIds },
        status: 'PENDING'
      }
    })

    // Get pending performance reviews
    const pendingReviews = await prisma.performanceReview.count({
      where: {
        employeeId: { in: teamMemberIds },
        status: { in: ['DRAFT', 'IN_REVIEW'] }
      }
    })

    // Calculate team performance (average rating from recent reviews)
    const recentReviews = await prisma.performanceReview.findMany({
      where: {
        employeeId: { in: teamMemberIds },
        overallRating: { not: null },
        completedAt: { not: null }
      },
      orderBy: { completedAt: 'desc' },
      take: teamSize * 2 // Get recent reviews for calculation
    })

    const teamPerformance = recentReviews.length > 0
      ? recentReviews.reduce((sum, review) => sum + Number(review.overallRating || 0), 0) / recentReviews.length
      : 0

    // Get upcoming deadlines (objectives due soon)
    const upcomingDeadlines = await prisma.objective.count({
      where: {
        employeeId: { in: teamMemberIds },
        endDate: {
          gte: today,
          lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
        },
        status: 'ACTIVE'
      }
    })

    const stats = {
      teamSize,
      presentToday,
      leaveRequests,
      pendingReviews,
      teamPerformance: Math.round(teamPerformance * 10) / 10, // Round to 1 decimal place
      upcomingDeadlines
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching manager dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}
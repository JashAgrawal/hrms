import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/hr/stats - Get HR dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has HR permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const currentDate = new Date()
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)

    // Get total employees
    const totalEmployees = await prisma.employee.count({
      where: { status: 'ACTIVE' }
    })

    // Get new hires this month
    const newHires = await prisma.employee.count({
      where: {
        joiningDate: {
          gte: currentMonth,
          lt: nextMonth
        },
        status: 'ACTIVE'
      }
    })

    // Get pending onboarding workflows
    const pendingOnboarding = await prisma.onboardingWorkflow.count({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      }
    })

    // Get pending leave requests
    const leaveRequests = await prisma.leaveRequest.count({
      where: { status: 'PENDING' }
    })

    // Get attendance issues (pending attendance requests)
    const attendanceIssues = await prisma.attendanceRequest.count({
      where: { status: 'PENDING' }
    })

    // Get documents to review (pending document submissions)
    const documentsToReview = await prisma.document.count({
      where: {
        status: 'UNDER_REVIEW'
      }
    })

    const stats = {
      totalEmployees,
      newHires,
      pendingOnboarding,
      leaveRequests,
      attendanceIssues,
      documentsToReview
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching HR dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}
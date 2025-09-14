import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/activities - Get recent activities for dashboard
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const employeeId = currentUser.employee.id

    // Get recent audit logs for the user (their activities)
    const recentActivities = await prisma.auditLog.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit
    })

    // Transform audit logs into activity format
    const activities = recentActivities.map(log => {
      let action = 'performed an action'
      let target = ''
      let status: 'success' | 'warning' | 'error' = 'success'

      // Map different actions to user-friendly descriptions
      switch (log.action) {
        case 'LOGIN':
          action = 'logged in'
          target = 'to the system'
          break
        case 'ATTENDANCE_CHECK_IN':
          action = 'checked in'
          target = new Date(log.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })
          break
        case 'ATTENDANCE_CHECK_OUT':
          action = 'checked out'
          target = new Date(log.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })
          break
        case 'LEAVE_REQUEST_CREATE':
          action = 'submitted leave request'
          target = (log.details as any)?.leaveType || 'leave'
          break
        case 'EXPENSE_CLAIM_CREATE':
          action = 'submitted expense claim'
          target = `₹${(log.details as any)?.amount || 0}`
          break
        case 'EXPENSE_CLAIM_APPROVE':
          action = 'approved expense claim'
          target = `₹${(log.details as any)?.amount || 0}`
          break
        case 'LEAVE_REQUEST_APPROVE':
          action = 'approved leave request'
          target = (log.details as any)?.employeeName || 'employee'
          break
        default:
          action = log.action.toLowerCase().replace(/_/g, ' ')
          target = log.resource || ''
      }

      if (!log.success) {
        status = 'error'
      }

      return {
        id: log.id,
        user: {
          name: log.userName || currentUser.name || 'You',
          avatar: ''
        },
        action,
        target,
        timestamp: log.timestamp,
        status
      }
    })

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Error fetching dashboard activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}
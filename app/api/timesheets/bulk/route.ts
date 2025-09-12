import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission } from '@/lib/permissions'

// Validation schemas
const BulkApprovalSchema = z.object({
  timesheetIds: z.array(z.string()).min(1),
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional()
})

const BulkSubmissionSchema = z.object({
  timesheetIds: z.array(z.string()).min(1)
})

const BulkDeleteSchema = z.object({
  timesheetIds: z.array(z.string()).min(1)
})

// POST /api/timesheets/bulk - Bulk operations on timesheets
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const operation = searchParams.get('operation')
    const body = await request.json()

    switch (operation) {
      case 'approve':
        return await handleBulkApproval(session.user.id, body)
      case 'submit':
        return await handleBulkSubmission(session.user.id, body)
      case 'delete':
        return await handleBulkDelete(session.user.id, body)
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in bulk operation:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to perform bulk operation' }, { status: 500 })
  }
}

// Handle bulk approval/rejection
async function handleBulkApproval(userId: string, body: any) {
  const validatedData = BulkApprovalSchema.parse(body)
  const { timesheetIds, action, comments } = validatedData

  // Fetch all timesheets to validate permissions
  const timesheets = await prisma.timesheet.findMany({
    where: { 
      id: { in: timesheetIds },
      status: 'SUBMITTED' // Only submitted timesheets can be approved
    },
    include: {
      employee: {
        include: {
          user: { select: { id: true } },
          manager: { select: { id: true } }
        }
      }
    }
  })

  if (timesheets.length === 0) {
    return NextResponse.json({ error: 'No valid timesheets found for approval' }, { status: 404 })
  }

  // Get current user details
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true }
  })

  if (!currentUser?.employee) {
    return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
  }

  // Check permissions for each timesheet
  const unauthorizedTimesheets: string[] = []
  const authorizedTimesheets: typeof timesheets = []

  for (const timesheet of timesheets) {
    const canApprove = await checkPermission(userId, {
      module: 'TIMESHEET',
      action: 'APPROVE',
      resource: 'TEAM'
    }, { targetUserId: timesheet.employee.user?.id })

    if (canApprove.allowed) {
      authorizedTimesheets.push(timesheet)
    } else {
      // Check if user is direct manager
      const isDirectManager = timesheet.employee.reportingTo === currentUser.employee.id
      const isSameDepartmentManager = timesheet.employee.departmentId === currentUser.employee.departmentId && 
                                     ['MANAGER', 'HR', 'ADMIN'].includes(currentUser.role)

      if (isDirectManager || isSameDepartmentManager) {
        authorizedTimesheets.push(timesheet)
      } else {
        unauthorizedTimesheets.push(timesheet.id)
      }
    }
  }

  if (authorizedTimesheets.length === 0) {
    return NextResponse.json({ 
      error: 'No timesheets authorized for approval',
      unauthorizedIds: unauthorizedTimesheets
    }, { status: 403 })
  }

  // Process bulk approval in transaction
  const results = await prisma.$transaction(async (tx) => {
    const processedTimesheets = []

    for (const timesheet of authorizedTimesheets) {
      const updatedTimesheet = await tx.timesheet.update({
        where: { id: timesheet.id },
        data: {
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          approvedBy: userId,
          approvedAt: action === 'APPROVE' ? new Date() : null,
          rejectedAt: action === 'REJECT' ? new Date() : null,
          rejectionReason: action === 'REJECT' ? comments : null
        }
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: action === 'APPROVE' ? 'TIMESHEET_BULK_APPROVED' : 'TIMESHEET_BULK_REJECTED',
          resource: 'TIMESHEET',
          resourceId: timesheet.id,
          details: {
            employeeId: timesheet.employeeId,
            employeeName: `${timesheet.employee.firstName} ${timesheet.employee.lastName}`,
            period: `${timesheet.startDate.toISOString().split('T')[0]} to ${timesheet.endDate.toISOString().split('T')[0]}`,
            totalHours: timesheet.totalHours,
            comments,
            bulkOperation: true
          }
        }
      })

      processedTimesheets.push(updatedTimesheet)
    }

    return processedTimesheets
  })

  return NextResponse.json({
    message: `${results.length} timesheets ${action.toLowerCase()}d successfully`,
    processedCount: results.length,
    unauthorizedCount: unauthorizedTimesheets.length,
    unauthorizedIds: unauthorizedTimesheets
  })
}

// Handle bulk submission
async function handleBulkSubmission(userId: string, body: any) {
  const validatedData = BulkSubmissionSchema.parse(body)
  const { timesheetIds } = validatedData

  // Get current user details
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true }
  })

  if (!currentUser?.employee) {
    return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
  }

  // Fetch timesheets that belong to the user and are in DRAFT status
  const timesheets = await prisma.timesheet.findMany({
    where: { 
      id: { in: timesheetIds },
      employeeId: currentUser.employee.id,
      status: 'DRAFT'
    }
  })

  if (timesheets.length === 0) {
    return NextResponse.json({ error: 'No valid draft timesheets found' }, { status: 404 })
  }

  // Submit timesheets in transaction
  const results = await prisma.$transaction(async (tx) => {
    const submittedTimesheets = []

    for (const timesheet of timesheets) {
      const updatedTimesheet = await tx.timesheet.update({
        where: { id: timesheet.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date()
        }
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'TIMESHEET_BULK_SUBMITTED',
          resource: 'TIMESHEET',
          resourceId: timesheet.id,
          details: {
            period: `${timesheet.startDate.toISOString().split('T')[0]} to ${timesheet.endDate.toISOString().split('T')[0]}`,
            totalHours: timesheet.totalHours,
            bulkOperation: true
          }
        }
      })

      submittedTimesheets.push(updatedTimesheet)
    }

    return submittedTimesheets
  })

  return NextResponse.json({
    message: `${results.length} timesheets submitted successfully`,
    submittedCount: results.length
  })
}

// Handle bulk deletion
async function handleBulkDelete(userId: string, body: any) {
  const validatedData = BulkDeleteSchema.parse(body)
  const { timesheetIds } = validatedData

  // Get current user details
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true }
  })

  if (!currentUser?.employee) {
    return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
  }

  // Fetch timesheets that can be deleted (DRAFT or REJECTED status)
  const timesheets = await prisma.timesheet.findMany({
    where: { 
      id: { in: timesheetIds },
      employeeId: currentUser.employee.id,
      status: { in: ['DRAFT', 'REJECTED'] }
    }
  })

  if (timesheets.length === 0) {
    return NextResponse.json({ error: 'No valid timesheets found for deletion' }, { status: 404 })
  }

  // Delete timesheets in transaction
  const results = await prisma.$transaction(async (tx) => {
    // Create audit logs before deletion
    for (const timesheet of timesheets) {
      await tx.auditLog.create({
        data: {
          userId,
          action: 'TIMESHEET_BULK_DELETED',
          resource: 'TIMESHEET',
          resourceId: timesheet.id,
          details: {
            period: `${timesheet.startDate.toISOString().split('T')[0]} to ${timesheet.endDate.toISOString().split('T')[0]}`,
            totalHours: timesheet.totalHours,
            status: timesheet.status,
            bulkOperation: true
          }
        }
      })
    }

    // Delete timesheets (entries will be cascade deleted)
    const deleteResult = await tx.timesheet.deleteMany({
      where: { id: { in: timesheets.map(t => t.id) } }
    })

    return deleteResult
  })

  return NextResponse.json({
    message: `${results.count} timesheets deleted successfully`,
    deletedCount: results.count
  })
}

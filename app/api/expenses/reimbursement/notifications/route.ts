import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/email-service'
import { z } from 'zod'

const sendNotificationSchema = z.object({
  type: z.enum(['BATCH_STATUS', 'PAYMENT_REMINDER', 'BULK_NOTIFICATION']),
  batchId: z.string().optional(),
  employeeIds: z.array(z.string()).optional(),
  notificationType: z.enum(['PROCESSING', 'COMPLETED', 'FAILED', 'REMINDER']).optional(),
  customMessage: z.string().optional(),
  includeFinanceTeam: z.boolean().default(false)
})

const notificationHistorySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  type: z.enum(['BATCH_STATUS', 'PAYMENT_REMINDER', 'BULK_NOTIFICATION']).optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional()
})

// POST /api/expenses/reimbursement/notifications - Send reimbursement notifications
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const canSendNotifications = ['ADMIN', 'FINANCE', 'HR'].includes(user?.role || '')
    
    if (!canSendNotifications) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = sendNotificationSchema.parse(body)

    let result: any = {}

    switch (validatedData.type) {
      case 'BATCH_STATUS':
        if (!validatedData.batchId) {
          return NextResponse.json(
            { error: 'Batch ID is required for batch status notifications' },
            { status: 400 }
          )
        }
        result = await sendBatchStatusNotifications(
          validatedData.batchId,
          validatedData.notificationType!,
          validatedData.customMessage,
          validatedData.includeFinanceTeam
        )
        break

      case 'PAYMENT_REMINDER':
        result = await sendPaymentReminders(
          validatedData.employeeIds,
          validatedData.customMessage
        )
        break

      case 'BULK_NOTIFICATION':
        if (!validatedData.employeeIds || validatedData.employeeIds.length === 0) {
          return NextResponse.json(
            { error: 'Employee IDs are required for bulk notifications' },
            { status: 400 }
          )
        }
        result = await sendBulkNotifications(
          validatedData.employeeIds,
          validatedData.notificationType!,
          validatedData.customMessage
        )
        break

      default:
        return NextResponse.json(
          { error: 'Invalid notification type' },
          { status: 400 }
        )
    }

    // Log notification activity
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REIMBURSEMENT_NOTIFICATION_SENT',
        resource: 'NOTIFICATION',
        details: {
          type: validatedData.type,
          batchId: validatedData.batchId,
          employeeIds: validatedData.employeeIds,
          notificationType: validatedData.notificationType,
          result
        }
      }
    })

    return NextResponse.json({
      message: 'Notifications sent successfully',
      result
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error sending reimbursement notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/expenses/reimbursement/notifications - Get notification history
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const canViewNotifications = ['ADMIN', 'FINANCE', 'HR'].includes(user?.role || '')
    
    if (!canViewNotifications) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = notificationHistorySchema.parse(Object.fromEntries(searchParams))

    // Build filter conditions
    const where: any = {
      action: 'REIMBURSEMENT_NOTIFICATION_SENT'
    }

    if (query.startDate && query.endDate) {
      where.createdAt = {
        gte: query.startDate,
        lte: query.endDate
      }
    }

    if (query.type) {
      where.details = {
        path: ['type'],
        equals: query.type
      }
    }

    // Get total count
    const totalCount = await prisma.auditLog.count({ where })

    // Get notification history
    const notifications = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            employee: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    })

    return NextResponse.json({
      notifications: notifications.map(notification => {
        const details = notification.details as any;
        return {
          id: notification.id,
          type: details?.type,
          notificationType: details?.notificationType,
          batchId: details?.batchId,
          employeeCount: details?.employeeIds?.length || 0,
          result: details?.result,
          sentBy: {
            email: notification.user?.email,
            name: notification.user?.employee ? 
              `${notification.user.employee.firstName} ${notification.user.employee.lastName}` : 
              notification.user?.email
          },
          sentAt: notification.timestamp
        };
      }),
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / query.limit)
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching notification history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to send batch status notifications
async function sendBatchStatusNotifications(
  batchId: string,
  notificationType: string,
  customMessage?: string,
  includeFinanceTeam: boolean = false
) {
  // Get batch details with employee information
  const batch = await prisma.reimbursementBatch.findUnique({
    where: { id: batchId },
    include: {
      expenseClaims: {
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }
    }
  })

  if (!batch) {
    throw new Error('Batch not found')
  }

  // Group claims by employee
  const employeeClaimsMap = new Map()
  batch.expenseClaims.forEach(claim => {
    const empId = claim.employee.id
    if (!employeeClaimsMap.has(empId)) {
      employeeClaimsMap.set(empId, {
        employee: claim.employee,
        claims: [],
        totalAmount: 0
      })
    }
    const empData = employeeClaimsMap.get(empId)
    empData.claims.push(claim)
    empData.totalAmount += claim.amount.toNumber()
  })

  // Prepare notifications for employees
  const notifications = Array.from(employeeClaimsMap.values()).map(empData => ({
    employeeEmail: empData.employee.email,
    employeeName: `${empData.employee.firstName} ${empData.employee.lastName}`,
    type: notificationType as 'PROCESSING' | 'COMPLETED' | 'FAILED',
    batchId: batch.batchId,
    amount: empData.totalAmount,
    claimCount: empData.claims.length,
    referenceNumber: batch.referenceNumber || undefined,
    paymentMethod: batch.paymentMethod.toString(),
    failureReason: batch.failureReason || undefined,
    customMessage
  }))

  // Send employee notifications
  const employeeResult = await emailService.sendBulkReimbursementNotifications(notifications)

  let financeResult = null
  if (includeFinanceTeam) {
    // Send finance team notification
    const financeNotificationType = 
      notificationType === 'PROCESSING' ? 'BATCH_CREATED' :
      notificationType === 'COMPLETED' ? 'BATCH_COMPLETED' :
      'BATCH_FAILED'

    financeResult = await emailService.sendFinanceTeamNotification({
      type: financeNotificationType as 'BATCH_CREATED' | 'BATCH_COMPLETED' | 'BATCH_FAILED',
      batchId: batch.batchId,
      totalAmount: batch.totalAmount.toNumber(),
      totalClaims: batch.totalClaims,
      processedBy: 'System', // You might want to get actual user info
      referenceNumber: batch.referenceNumber || undefined,
      failureReason: batch.failureReason || undefined
    })
  }

  return {
    batchId: batch.batchId,
    employeeNotifications: employeeResult,
    financeNotification: financeResult,
    totalEmployees: notifications.length
  }
}

// Helper function to send payment reminders
async function sendPaymentReminders(employeeIds?: string[], customMessage?: string) {
  // Get employees with pending reimbursements
  const whereClause: any = {
    status: 'APPROVED',
    isReimbursable: true,
    reimbursedAt: null
  }

  if (employeeIds && employeeIds.length > 0) {
    whereClause.employeeId = { in: employeeIds }
  }

  // Group pending claims by employee
  const pendingClaims = await prisma.expenseClaim.findMany({
    where: whereClause,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  })

  const employeeClaimsMap = new Map()
  pendingClaims.forEach(claim => {
    const empId = claim.employee.id
    if (!employeeClaimsMap.has(empId)) {
      employeeClaimsMap.set(empId, {
        employee: claim.employee,
        claims: [],
        totalAmount: 0
      })
    }
    const empData = employeeClaimsMap.get(empId)
    empData.claims.push(claim)
    empData.totalAmount += claim.amount.toNumber()
  })

  if (employeeClaimsMap.size === 0) {
    return {
      message: 'No pending reimbursements found',
      employeeCount: 0,
      sent: 0,
      failed: 0
    }
  }

  // Send reminder notifications
  const notifications = Array.from(employeeClaimsMap.values()).map(empData => ({
    employeeEmail: empData.employee.email,
    employeeName: `${empData.employee.firstName} ${empData.employee.lastName}`,
    type: 'PROCESSING' as const,
    batchId: 'PENDING',
    amount: empData.totalAmount,
    claimCount: empData.claims.length,
    customMessage: customMessage || `Your expense claims totaling ₹${empData.totalAmount.toLocaleString()} are approved and will be processed in the next reimbursement batch.`
  }))

  const result = await emailService.sendBulkReimbursementNotifications(notifications)

  return {
    ...result,
    employeeCount: notifications.length,
    totalAmount: Array.from(employeeClaimsMap.values()).reduce((sum, emp) => sum + emp.totalAmount, 0)
  }
}

// Helper function to send bulk notifications
async function sendBulkNotifications(
  employeeIds: string[],
  notificationType: string,
  customMessage?: string
) {
  // Get employee details
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  })

  if (employees.length === 0) {
    return {
      message: 'No employees found',
      employeeCount: 0,
      sent: 0,
      failed: 0
    }
  }

  // Prepare notifications
  const notifications = employees.map(employee => ({
    employeeEmail: employee.email,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    type: notificationType as 'PROCESSING' | 'COMPLETED' | 'FAILED',
    batchId: 'BULK_NOTIFICATION',
    amount: 0,
    claimCount: 0,
    customMessage
  }))

  const result = await emailService.sendBulkReimbursementNotifications(notifications)

  return {
    ...result,
    employeeCount: notifications.length
  }
}
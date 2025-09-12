import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for expense approval
const approvalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional()
})

// POST /api/expenses/[id]/approve - Approve or reject an expense claim
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const body = await request.json()
    const { action, comments } = approvalSchema.parse(body)

    // Get expense claim with approvals and policy violations
    const expenseClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      include: {
        employee: {
          include: {
            department: true
          }
        },
        category: {
          include: {
            policyRules: true
          }
        },
        approvals: {
          orderBy: { level: 'asc' }
        },
        attachments: true
      }
    })

    if (!expenseClaim) {
      return NextResponse.json({ error: 'Expense claim not found' }, { status: 404 })
    }

    // Check if expense is in pending status
    if (expenseClaim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Expense claim is not in pending status' },
        { status: 400 }
      )
    }

    // Find the pending approval for this user
    const pendingApproval = expenseClaim.approvals.find(
      approval => approval.approverId === session.user.id && approval.status === 'PENDING'
    )

    if (!pendingApproval) {
      return NextResponse.json(
        { error: 'No pending approval found for this user' },
        { status: 403 }
      )
    }

    // Enhanced approval validation
    const approvalValidation = await validateApprovalAction(
      expenseClaim,
      pendingApproval,
      action,
      session.user.id
    )

    if (!approvalValidation.isValid) {
      return NextResponse.json(
        { error: approvalValidation.error },
        { status: 400 }
      )
    }

    // Update the approval with enhanced tracking
    const updatedApproval = await prisma.expenseApproval.update({
      where: { id: pendingApproval.id },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approvedAt: action === 'APPROVE' ? new Date() : null,
        rejectedAt: action === 'REJECT' ? new Date() : null,
        comments,
        notificationSent: false // Reset for notification
      }
    })

    // Determine next action based on approval workflow
    const workflowResult = await processApprovalWorkflow(
      expenseClaim,
      updatedApproval,
      action,
      session.user.id
    )

    // Update expense claim status based on workflow result
    if (workflowResult.updateExpense) {
      await prisma.expenseClaim.update({
        where: { id: resolvedParams.id },
        data: workflowResult.updateData
      })
    }

    // Create audit log for approval action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `EXPENSE_${action}D`,
        resource: 'EXPENSE_CLAIM',
        resourceId: resolvedParams.id,
        details: {
          expenseAmount: expenseClaim.amount.toNumber(),
          approvalLevel: pendingApproval.level,
          comments,
          policyViolations: expenseClaim.policyViolations,
          workflowStatus: workflowResult.status
        }
      }
    })

    // Send notifications if needed
    if (workflowResult.notifications && workflowResult.notifications.length > 0) {
      await sendApprovalNotifications(workflowResult.notifications)
    }

    // Get updated expense claim for response
    const updatedExpenseClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            email: true
          }
        },
        category: true,
        attachments: true,
        approvals: {
          orderBy: { level: 'asc' }
        }
      }
    })

    return NextResponse.json({
      expenseClaim: updatedExpenseClaim,
      approval: updatedApproval,
      workflowStatus: workflowResult.status,
      nextApprover: workflowResult.nextApprover,
      message: `Expense claim ${action.toLowerCase()}d successfully`
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing expense approval:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function validateApprovalAction(
  expenseClaim: any,
  approval: any,
  action: string,
  userId: string
) {
  // Check if approver has the right to approve this level
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true }
  })

  if (!user) {
    return { isValid: false, error: 'User not found' }
  }

  // Check role-based approval limits
  const roleApprovalLimits = {
    MANAGER: 50000,
    HR: 100000,
    FINANCE: 500000,
    ADMIN: Infinity
  }

  const userLimit = roleApprovalLimits[user.role as keyof typeof roleApprovalLimits] || 0
  
  if (action === 'APPROVE' && expenseClaim.amount.toNumber() > userLimit) {
    return { 
      isValid: false, 
      error: `Amount exceeds your approval limit of ₹${userLimit}` 
    }
  }

  // Check if this is the correct approval sequence
  const previousApprovals = expenseClaim.approvals.filter(
    (a: any) => a.level < approval.level
  )
  
  const hasPendingPreviousApprovals = previousApprovals.some(
    (a: any) => a.status === 'PENDING'
  )

  if (hasPendingPreviousApprovals) {
    return { 
      isValid: false, 
      error: 'Previous approval levels must be completed first' 
    }
  }

  return { isValid: true }
}

async function processApprovalWorkflow(
  expenseClaim: any,
  currentApproval: any,
  action: string,
  userId: string
) {
  const result = {
    status: 'IN_PROGRESS',
    updateExpense: false,
    updateData: {} as any,
    nextApprover: null as any,
    notifications: [] as any[]
  }

  if (action === 'REJECT') {
    // If rejected at any level, reject the entire claim
    result.status = 'REJECTED'
    result.updateExpense = true
    result.updateData = {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: currentApproval.comments,
      rejectedBy: userId
    }

    // Notify employee of rejection
    result.notifications.push({
      type: 'EXPENSE_REJECTED',
      recipientId: expenseClaim.employee.userId,
      data: {
        expenseId: expenseClaim.id,
        expenseTitle: expenseClaim.title,
        rejectionReason: currentApproval.comments,
        approvalLevel: currentApproval.level
      }
    })

    return result
  }

  // For approval, check if all required approvals are complete
  const totalApprovals = expenseClaim.approvals.length
  const approvedCount = expenseClaim.approvals.filter(
    (a: any) => a.status === 'APPROVED'
  ).length + 1 // +1 for current approval

  if (approvedCount >= totalApprovals) {
    // All approvals completed - approve the claim
    result.status = 'FULLY_APPROVED'
    result.updateExpense = true
    result.updateData = {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: userId
    }

    // Notify employee of approval
    result.notifications.push({
      type: 'EXPENSE_APPROVED',
      recipientId: expenseClaim.employee.userId,
      data: {
        expenseId: expenseClaim.id,
        expenseTitle: expenseClaim.title,
        approvedAmount: expenseClaim.amount.toNumber(),
        finalApprover: userId
      }
    })

    // Notify finance team for reimbursement processing
    result.notifications.push({
      type: 'EXPENSE_READY_FOR_REIMBURSEMENT',
      recipientRole: 'FINANCE',
      data: {
        expenseId: expenseClaim.id,
        expenseTitle: expenseClaim.title,
        amount: expenseClaim.amount.toNumber(),
        employeeName: `${expenseClaim.employee.firstName} ${expenseClaim.employee.lastName}`
      }
    })
  } else {
    // Find next approver
    const nextApprovalLevel = currentApproval.level + 1
    const nextApproval = expenseClaim.approvals.find(
      (a: any) => a.level === nextApprovalLevel
    )

    if (nextApproval) {
      result.nextApprover = {
        level: nextApproval.level,
        approverId: nextApproval.approverId,
        approverName: nextApproval.approverName
      }

      // Notify next approver
      result.notifications.push({
        type: 'EXPENSE_PENDING_APPROVAL',
        recipientId: nextApproval.approverId,
        data: {
          expenseId: expenseClaim.id,
          expenseTitle: expenseClaim.title,
          amount: expenseClaim.amount.toNumber(),
          employeeName: `${expenseClaim.employee.firstName} ${expenseClaim.employee.lastName}`,
          approvalLevel: nextApproval.level,
          previousApprover: userId
        }
      })
    }
  }

  return result
}

async function sendApprovalNotifications(notifications: any[]) {
  // This would integrate with your notification service
  // For now, we'll just log the notifications
  for (const notification of notifications) {
    console.log('Sending notification:', notification)
    
    // Here you would:
    // 1. Send email notifications
    // 2. Create in-app notifications
    // 3. Send SMS/WhatsApp if configured
    // 4. Update notification tracking
  }
}
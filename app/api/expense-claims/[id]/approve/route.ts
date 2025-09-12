import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const approveExpenseSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional(),
})

// POST /api/expense-claims/[id]/approve - Approve or reject expense claim
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const resolvedParams = await params
    const body = await request.json()
    const { action, comments } = approveExpenseSchema.parse(body)

    // Get expense claim with approvals
    const expenseClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      include: {
        approvals: {
          orderBy: { level: 'asc' },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            reportingTo: true,
          },
        },
        category: {
          select: {
            approvalLevels: true,
          },
        },
      },
    })

    if (!expenseClaim) {
      return NextResponse.json(
        { error: 'Expense claim not found' },
        { status: 404 }
      )
    }

    if (expenseClaim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Expense claim is not pending approval' },
        { status: 400 }
      )
    }

    // Find the approval record for this user
    const userApproval = expenseClaim.approvals.find(
      (approval) => approval.approverId === user.id && approval.status === 'PENDING'
    )

    if (!userApproval) {
      return NextResponse.json(
        { error: 'You are not authorized to approve this expense claim' },
        { status: 403 }
      )
    }

    // Update the approval record
    const updatedApproval = await prisma.expenseApproval.update({
      where: { id: userApproval.id },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        comments,
        approvedAt: action === 'APPROVE' ? new Date() : null,
        rejectedAt: action === 'REJECT' ? new Date() : null,
      },
    })

    // Check if this was a rejection or if all required approvals are complete
    let finalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = expenseClaim.status

    if (action === 'REJECT') {
      // If rejected at any level, reject the entire claim
      finalStatus = 'REJECTED'
      await prisma.expenseClaim.update({
        where: { id: resolvedParams.id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: comments || 'Rejected by approver',
        },
      })
    } else {
      // Check if all required approvals are complete
      const allApprovals = await prisma.expenseApproval.findMany({
        where: { expenseId: resolvedParams.id },
        orderBy: { level: 'asc' },
      })

      const allApproved = allApprovals.every(
        (approval) => approval.status === 'APPROVED'
      )

      if (allApproved) {
        finalStatus = 'APPROVED'
        await prisma.expenseClaim.update({
          where: { id: resolvedParams.id },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedBy: user.id,
          },
        })
      }
    }

    // Get updated expense claim
    const updatedClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        approvals: {
          orderBy: { level: 'asc' },
        },
      },
    })

    return NextResponse.json({
      expenseClaim: updatedClaim,
      approval: updatedApproval,
      message: `Expense claim ${action.toLowerCase()}d successfully`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing expense approval:', error)
    return NextResponse.json(
      { error: 'Failed to process expense approval' },
      { status: 500 }
    )
  }
}
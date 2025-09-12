import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has approval permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    const canApprove = ['ADMIN', 'HR', 'MANAGER', 'FINANCE'].includes(user?.role || '')
    
    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get expense claims that require approval from this user
    const pendingApprovals = await prisma.expenseApproval.findMany({
      where: {
        approverId: session.user.id,
        status: 'PENDING'
      },
      include: {
        expense: {
          include: {
            category: true,
            employee: true
          }
        }
      }
    })

    // Get all approvals by this user for statistics
    const allApprovals = await prisma.expenseApproval.findMany({
      where: {
        approverId: session.user.id,
        status: { in: ['APPROVED', 'REJECTED'] }
      },
      include: {
        expense: true
      }
    })

    // Calculate statistics
    const totalPending = pendingApprovals.length
    const totalApproved = allApprovals.filter(a => a.status === 'APPROVED').length
    const totalRejected = allApprovals.filter(a => a.status === 'REJECTED').length
    
    const totalAmount = pendingApprovals.reduce(
      (sum, approval) => sum + approval.expense.amount.toNumber(), 
      0
    )

    // Calculate average processing time
    const processedApprovals = allApprovals.filter(a => a.approvedAt)
    const avgProcessingTime = processedApprovals.length > 0 
      ? processedApprovals.reduce((sum, approval) => {
          const processingTime = approval.approvedAt!.getTime() - approval.expense.createdAt.getTime()
          return sum + (processingTime / (1000 * 60 * 60 * 24)) // Convert to days
        }, 0) / processedApprovals.length
      : 0

    const stats = {
      totalPending,
      totalApproved,
      totalRejected,
      totalAmount,
      avgProcessingTime: Math.round(avgProcessingTime * 10) / 10 // Round to 1 decimal place
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching approval stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const employeeId = searchParams.get('employeeId')

    // Get employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Build filter conditions
    const where: any = {
      employeeId: employeeId || employee.id
    }

    if (startDate && endDate) {
      where.expenseDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    // Get expense claims summary
    const [
      totalClaims,
      totalAmount,
      pendingClaims,
      pendingAmount,
      approvedClaims,
      approvedAmount,
      rejectedClaims,
      reimbursedAmount
    ] = await Promise.all([
      // Total claims count
      prisma.expenseClaim.count({ where }),
      
      // Total amount
      prisma.expenseClaim.aggregate({
        where,
        _sum: { amount: true }
      }),
      
      // Pending claims count
      prisma.expenseClaim.count({
        where: { ...where, status: 'PENDING' }
      }),
      
      // Pending amount
      prisma.expenseClaim.aggregate({
        where: { ...where, status: 'PENDING' },
        _sum: { amount: true }
      }),
      
      // Approved claims count
      prisma.expenseClaim.count({
        where: { ...where, status: 'APPROVED' }
      }),
      
      // Approved amount
      prisma.expenseClaim.aggregate({
        where: { ...where, status: 'APPROVED' },
        _sum: { amount: true }
      }),
      
      // Rejected claims count
      prisma.expenseClaim.count({
        where: { ...where, status: 'REJECTED' }
      }),
      
      // Reimbursed amount
      prisma.expenseClaim.aggregate({
        where: { ...where, status: 'REIMBURSED' },
        _sum: { amount: true }
      })
    ])

    const summary = {
      totalClaims,
      totalAmount: totalAmount._sum.amount?.toNumber() || 0,
      pendingClaims,
      pendingAmount: pendingAmount._sum.amount?.toNumber() || 0,
      approvedClaims,
      approvedAmount: approvedAmount._sum.amount?.toNumber() || 0,
      rejectedClaims,
      reimbursedAmount: reimbursedAmount._sum.amount?.toNumber() || 0
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error fetching expense summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
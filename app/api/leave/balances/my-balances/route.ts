import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const currentYear = new Date().getFullYear()

    // Get leave balances for the current user
    const balances = await prisma.leaveBalance.findMany({
      where: {
        employeeId: currentUser.employee.id,
        year: currentYear
      },
      include: {
        policy: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        }
      },
      orderBy: {
        policy: {
          name: 'asc'
        }
      }
    })

    // Calculate available balance for each policy
    const balancesWithAvailable = balances.map(balance => ({
      ...balance,
      available: Math.max(0, Number(balance.allocated) - Number(balance.used) - Number(balance.pending))
    }))

    return NextResponse.json({
      balances: balancesWithAvailable,
      year: currentYear
    })
  } catch (error) {
    console.error('Error fetching leave balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave balances' },
      { status: 500 }
    )
  }
}

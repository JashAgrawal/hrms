import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// GET /api/petrol-expense-config/history - Get configuration history
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to view config history
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['ADMIN', 'FINANCE', 'HR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const configs = await prisma.petrolExpenseConfig.findMany({
      orderBy: { effectiveFrom: 'desc' },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('Error fetching petrol expense config history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configuration history' },
      { status: 500 }
    )
  }
}
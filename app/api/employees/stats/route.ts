import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to view employee stats
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser || !['ADMIN', 'HR', 'MANAGER'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const [total, active, inactive, onLeave] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.employee.count({ where: { status: 'INACTIVE' } }),
      prisma.employee.count({ where: { status: 'ON_LEAVE' } }),
    ])

    return NextResponse.json({ 
      total, 
      active, 
      inactive, 
      onLeave 
    })
  } catch (error) {
    console.error('Error fetching employee stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee statistics' },
      { status: 500 }
    )
  }
}

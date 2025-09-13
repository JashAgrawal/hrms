import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/employees/me - Get current user's employee information
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { 
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
            employeeType: true,
            status: true,
            departmentId: true,
            joiningDate: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    return NextResponse.json(user.employee)
  } catch (error) {
    console.error('Error fetching employee info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee information' },
      { status: 500 }
    )
  }
}

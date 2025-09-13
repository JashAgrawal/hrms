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

    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')

    if (!startParam || !endParam) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 })
    }

    const startDate = new Date(startParam)
    const endDate = new Date(endParam)

    // Build query conditions based on user role
    let whereCondition: any = {
      status: { in: ['APPROVED', 'PENDING'] }, // Show approved and pending leaves
      OR: [
        // Leaves that start within the date range
        {
          startDate: {
            gte: startDate,
            lte: endDate
          }
        },
        // Leaves that end within the date range
        {
          endDate: {
            gte: startDate,
            lte: endDate
          }
        },
        // Leaves that span the entire date range
        {
          startDate: { lte: startDate },
          endDate: { gte: endDate }
        }
      ]
    }

    const isEmployee = currentUser.role === 'EMPLOYEE'
    
    if (isEmployee) {
      // Employee sees only their own leaves
      whereCondition.employeeId = currentUser.employee.id
    } else if (currentUser.role === 'MANAGER') {
      // Manager sees their team's leaves
      whereCondition.OR = [
        {
          ...whereCondition.OR[0],
          employee: {
            OR: [
              { reportingTo: currentUser.employee.id }, // Direct reports
              { departmentId: currentUser.employee.departmentId } // Same department
            ]
          }
        },
        {
          ...whereCondition.OR[1],
          employee: {
            OR: [
              { reportingTo: currentUser.employee.id },
              { departmentId: currentUser.employee.departmentId }
            ]
          }
        },
        {
          ...whereCondition.OR[2],
          employee: {
            OR: [
              { reportingTo: currentUser.employee.id },
              { departmentId: currentUser.employee.departmentId }
            ]
          }
        }
      ]
    }
    // HR and ADMIN see all leaves (no additional conditions)

    const leaveEvents = await prisma.leaveRequest.findMany({
      where: whereCondition,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true
          }
        },
        policy: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    })

    // Transform to calendar event format
    const events = leaveEvents.map(leave => {
      const user = {
        firstName: leave.employee.firstName,
        lastName: leave.employee.lastName
      }

      return {
        id: leave.id,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        employee: {
          firstName: user.firstName,
          lastName: user.lastName
        },
        policy: {
          name: leave.policy.name,
          code: leave.policy.code
        },
        status: leave.status,
        days: leave.days,
        isHalfDay: leave.isHalfDay,
        halfDayType: leave.halfDayType
      }
    })

    return NextResponse.json({
      events,
      total: events.length
    })
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    )
  }
}

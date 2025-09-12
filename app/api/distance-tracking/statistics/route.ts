import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DistanceTrackingService } from '@/lib/distance-tracking-service'
import { z } from 'zod'

const getStatisticsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const employeeId = searchParams.get('employeeId')

    // Validate query parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    const validatedParams = getStatisticsSchema.parse({
      startDate,
      endDate,
      employeeId: employeeId || undefined,
    })

    // Determine which employee's statistics to fetch
    let targetEmployeeId = validatedParams.employeeId

    if (!targetEmployeeId) {
      // If no employeeId specified, get current user's employee record
      const employee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })

      if (!employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
      }

      targetEmployeeId = employee.id
    } else {
      // Check if user has permission to view other employee's data
      if (!['ADMIN', 'HR', 'MANAGER'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    const startDateObj = new Date(validatedParams.startDate)
    const endDateObj = new Date(validatedParams.endDate)

    const statistics = await DistanceTrackingService.getDistanceStatistics(
      targetEmployeeId,
      startDateObj,
      endDateObj
    )

    // Get employee details for context
    const employee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        employeeType: true,
      }
    })

    return NextResponse.json({
      employee,
      period: {
        startDate: validatedParams.startDate,
        endDate: validatedParams.endDate,
      },
      statistics: {
        ...statistics,
        // Convert meters to kilometers for better readability
        totalDistanceKm: Math.round(statistics.totalDistance / 1000 * 100) / 100,
        averageDistancePerDayKm: Math.round(statistics.averageDistancePerDay / 1000 * 100) / 100,
        maxDistancePerDayKm: Math.round(statistics.maxDistancePerDay / 1000 * 100) / 100,
        // Convert seconds to hours for duration
        totalDurationHours: Math.round(statistics.totalDuration / 3600 * 100) / 100,
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching distance statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch distance statistics' },
      { status: 500 }
    )
  }
}
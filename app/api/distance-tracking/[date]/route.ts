import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DistanceTrackingService } from '@/lib/distance-tracking-service'

interface RouteParams {
  params: Promise<{
    date: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(resolvedParams.date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Determine which employee's records to fetch
    let targetEmployeeId = employeeId

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

    const date = new Date(resolvedParams.date)
    const distanceRecord = await DistanceTrackingService.getDailyDistanceRecord(
      targetEmployeeId,
      date
    )

    if (!distanceRecord) {
      return NextResponse.json({
        distanceRecord: null,
        message: 'No distance record found for this date'
      })
    }

    return NextResponse.json({
      distanceRecord
    })

  } catch (error) {
    console.error('Error fetching daily distance record:', error)
    return NextResponse.json(
      { error: 'Failed to fetch daily distance record' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admins and HR to recalculate distances
    if (!['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const resolvedParams = await params
    const { employeeId } = await request.json()

    if (!employeeId) {
      return NextResponse.json(
        { error: 'employeeId is required' },
        { status: 400 }
      )
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(resolvedParams.date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const date = new Date(resolvedParams.date)
    const recalculatedRecord = await DistanceTrackingService.recalculateDistances(
      employeeId,
      date
    )

    return NextResponse.json({
      distanceRecord: recalculatedRecord,
      message: 'Distances recalculated successfully'
    })

  } catch (error) {
    console.error('Error recalculating distances:', error)
    return NextResponse.json(
      { error: 'Failed to recalculate distances' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema for attendance queries
const attendanceQuerySchema = z.object({
  employeeId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME', 'ON_LEAVE', 'HOLIDAY']).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
})

// GET /api/attendance - Get attendance records
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = attendanceQuerySchema.parse(Object.fromEntries(searchParams))

    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Build where clause based on permissions
    const whereClause: any = {}

    // If specific employee requested, check permissions
    if (query.employeeId) {
      if (user.role === 'EMPLOYEE' && query.employeeId !== user.employee.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      whereClause.employeeId = query.employeeId
    } else {
      // Default to own records for employees
      if (user.role === 'EMPLOYEE') {
        whereClause.employeeId = user.employee.id
      }
    }

    // Add date filters
    if (query.startDate) {
      whereClause.date = { ...whereClause.date, gte: new Date(query.startDate) }
    }
    if (query.endDate) {
      whereClause.date = { ...whereClause.date, lte: new Date(query.endDate) }
    }

    // Add status filter
    if (query.status) {
      whereClause.status = query.status
    }

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: {
              select: { name: true }
            }
          }
        },
        checkInOut: {
          orderBy: { timestamp: 'asc' }
        }
      },
      orderBy: { date: 'desc' },
      take: query.limit || 50,
      skip: query.offset || 0,
    })

    return NextResponse.json({
      records: attendanceRecords,
      total: attendanceRecords.length
    })

  } catch (error) {
    console.error('Error fetching attendance records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance records' },
      { status: 500 }
    )
  }
}
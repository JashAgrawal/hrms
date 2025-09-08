import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PayrollRecordStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const payrollRunId = searchParams.get('payrollRunId')
    const period = searchParams.get('period')
    const status = searchParams.get('status') as PayrollRecordStatus | null
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Check permissions - employees can only view their own records
    if (session.user.role === 'EMPLOYEE') {
      if (!session.user.employeeId) {
        return NextResponse.json({ error: 'Employee ID not found' }, { status: 400 })
      }
      if (employeeId && employeeId !== session.user.employeeId) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    } else if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const whereClause: any = {}
    
    // Apply filters
    if (employeeId) {
      whereClause.employeeId = employeeId
    } else if (session.user.role === 'EMPLOYEE' && session.user.employeeId) {
      whereClause.employeeId = session.user.employeeId
    }
    
    if (payrollRunId) {
      whereClause.payrollRunId = payrollRunId
    }
    
    if (status) {
      whereClause.status = status
    }
    
    if (period) {
      whereClause.payrollRun = {
        period: period,
      }
    }

    const payrollRecords = await prisma.payrollRecord.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
            department: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
        payrollRun: {
          select: {
            id: true,
            period: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
      orderBy: [
        { payrollRun: { period: 'desc' } },
        { employee: { employeeCode: 'asc' } },
      ],
      take: limit,
      skip: offset,
    })

    const total = await prisma.payrollRecord.count({
      where: whereClause,
    })

    return NextResponse.json({
      payrollRecords,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('Error fetching payroll records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payroll records' },
      { status: 500 }
    )
  }
}
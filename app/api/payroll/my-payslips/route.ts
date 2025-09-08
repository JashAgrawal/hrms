import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the employee record for the current user
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const limit = parseInt(searchParams.get('limit') || '12')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const whereClause: any = {
      employeeId: employee.id,
      status: { in: ['APPROVED', 'PAID'] },
    }

    if (year) {
      whereClause.payrollRun = {
        period: {
          startsWith: year,
        },
      }
    }

    // Get payroll records for the employee
    const payrollRecords = await prisma.payrollRecord.findMany({
      where: whereClause,
      include: {
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
      orderBy: {
        payrollRun: {
          period: 'desc',
        },
      },
      take: limit,
      skip: offset,
    })

    const total = await prisma.payrollRecord.count({
      where: whereClause,
    })

    // Format the response to match component expectations
    const payslips = payrollRecords.map(record => ({
      id: record.id,
      fileName: `payslip_${record.payrollRun.period}_${employee.employeeCode}.pdf`,
      fileSize: 245760, // Mock file size - replace with actual
      generatedAt: record.createdAt || new Date().toISOString(),
      accessedAt: record.updatedAt,
      downloadCount: 0, // Mock download count - replace with actual
      status: 'GENERATED',
      emailSent: true,
      emailSentAt: record.createdAt,
      payrollRun: {
        period: record.payrollRun.period,
        startDate: record.payrollRun.startDate.toISOString(),
        endDate: record.payrollRun.endDate.toISOString(),
        status: record.payrollRun.status,
      },
      // Additional fields for backward compatibility
      periodDisplay: formatPeriod(record.payrollRun.period),
      grossSalary: record.grossSalary,
      netSalary: record.netSalary,
      totalDeductions: record.totalDeductions,
      payrollRunStatus: record.payrollRun.status,
      canDownload: ['APPROVED', 'PAID'].includes(record.status),
    }))

    return NextResponse.json({
      payslips,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        designation: employee.designation,
      },
    })
  } catch (error) {
    console.error('Error fetching employee payslips:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payslips' },
      { status: 500 }
    )
  }
}

function formatPeriod(period: string): string {
  const [year, month] = period.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reportRequestSchema = z.object({
  reportType: z.enum(['summary', 'detailed', 'statutory', 'comparison', 'analytics']),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  departmentId: z.string().optional(),
  employeeId: z.string().optional(),
  format: z.enum(['pdf', 'excel', 'csv']),
  includeInactive: z.boolean().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = reportRequestSchema.parse(body)

    // Parse period
    const [year, month] = validatedData.period.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    // Build where clause
    const where: any = {
      payrollRun: {
        period: validatedData.period,
      },
    }

    if (validatedData.departmentId) {
      where.employee = {
        departmentId: validatedData.departmentId,
      }
    }

    if (validatedData.employeeId) {
      where.employeeId = validatedData.employeeId
    }

    if (!validatedData.includeInactive) {
      where.employee = {
        ...where.employee,
        status: 'ACTIVE',
      }
    }

    // Generate report based on type
    let reportData: any = {}

    switch (validatedData.reportType) {
      case 'summary':
        reportData = await generateSummaryReport(where, validatedData.period)
        break
      case 'detailed':
        reportData = await generateDetailedReport(where, validatedData.period)
        break
      case 'statutory':
        reportData = await generateStatutoryReport(where, validatedData.period)
        break
      case 'comparison':
        reportData = await generateComparisonReport(validatedData)
        break
      case 'analytics':
        reportData = await generateAnalyticsReport(where, validatedData.period)
        break
      default:
        throw new Error('Invalid report type')
    }

    // Store report for download
    const reportRecord = await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'GENERATE_PAYROLL_REPORT',
        resource: 'PAYROLL_REPORT',
        details: {
          reportType: validatedData.reportType,
          period: validatedData.period,
          filters: validatedData,
          recordCount: reportData.records?.length || 0,
        },
      },
    })

    return NextResponse.json({
      id: reportRecord.id,
      reportType: validatedData.reportType,
      period: validatedData.period,
      generatedAt: new Date().toISOString(),
      ...reportData,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error generating payroll report:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 }
    )
  }
}

async function generateSummaryReport(where: any, period: string) {
  // Get payroll records
  const records = await prisma.payrollRecord.findMany({
    where,
    include: {
      employee: {
        include: {
          department: true,
        },
      },
    },
  })

  // Calculate totals
  const totalEmployees = records.length
  const totalGross = records.reduce((sum, record) => sum + parseFloat(record.grossSalary.toString()), 0)
  const totalNet = records.reduce((sum, record) => sum + parseFloat(record.netSalary.toString()), 0)
  const totalDeductions = records.reduce((sum, record) => sum + parseFloat(record.totalDeductions.toString()), 0)
  const averageSalary = totalEmployees > 0 ? totalNet / totalEmployees : 0

  // Department breakdown
  const departmentMap = new Map()
  records.forEach(record => {
    const deptName = record.employee.department.name
    if (!departmentMap.has(deptName)) {
      departmentMap.set(deptName, {
        departmentName: deptName,
        employeeCount: 0,
        totalGross: 0,
        totalNet: 0,
        averageSalary: 0,
      })
    }
    
    const dept = departmentMap.get(deptName)
    dept.employeeCount++
    dept.totalGross += parseFloat(record.grossSalary.toString())
    dept.totalNet += parseFloat(record.netSalary.toString())
  })

  // Calculate averages
  const departmentBreakdown = Array.from(departmentMap.values()).map(dept => ({
    ...dept,
    averageSalary: dept.employeeCount > 0 ? dept.totalNet / dept.employeeCount : 0,
  }))

  // Component breakdown (simplified - would need actual component data)
  const componentBreakdown = [
    {
      componentName: 'Basic Salary',
      componentType: 'EARNING' as const,
      totalAmount: records.reduce((sum, record) => sum + parseFloat(record.basicSalary.toString()), 0),
      averageAmount: records.length > 0 ? records.reduce((sum, record) => sum + parseFloat(record.basicSalary.toString()), 0) / records.length : 0,
      employeeCount: records.length,
    },
    {
      componentName: 'PF Deduction',
      componentType: 'DEDUCTION' as const,
      totalAmount: records.reduce((sum, record) => sum + (parseFloat(record.pfDeduction?.toString() || '0')), 0),
      averageAmount: records.length > 0 ? records.reduce((sum, record) => sum + (parseFloat(record.pfDeduction?.toString() || '0')), 0) / records.length : 0,
      employeeCount: records.filter(r => r.pfDeduction && parseFloat(r.pfDeduction.toString()) > 0).length,
    },
  ]

  return {
    summary: {
      period,
      totalEmployees,
      totalGross,
      totalNet,
      totalDeductions,
      averageSalary,
      departmentBreakdown,
      componentBreakdown,
    },
    records: records.map(record => ({
      id: record.id,
      employee: {
        employeeCode: record.employee.employeeCode,
        firstName: record.employee.firstName,
        lastName: record.employee.lastName,
        designation: record.employee.designation,
        department: {
          name: record.employee.department.name,
        },
      },
      basicSalary: parseFloat(record.basicSalary.toString()),
      grossSalary: parseFloat(record.grossSalary.toString()),
      netSalary: parseFloat(record.netSalary.toString()),
      totalEarnings: parseFloat(record.totalEarnings.toString()),
      totalDeductions: parseFloat(record.totalDeductions.toString()),
      workingDays: record.workingDays,
      presentDays: parseFloat(record.presentDays.toString()),
      status: record.status,
    })),
  }
}

async function generateDetailedReport(where: any, period: string) {
  const records = await prisma.payrollRecord.findMany({
    where,
    include: {
      employee: {
        include: {
          department: true,
        },
      },
      payrollRun: true,
    },
  })

  return {
    records: records.map(record => ({
      id: record.id,
      employee: {
        employeeCode: record.employee.employeeCode,
        firstName: record.employee.firstName,
        lastName: record.employee.lastName,
        designation: record.employee.designation,
        department: {
          name: record.employee.department.name,
        },
      },
      basicSalary: parseFloat(record.basicSalary.toString()),
      grossSalary: parseFloat(record.grossSalary.toString()),
      netSalary: parseFloat(record.netSalary.toString()),
      totalEarnings: parseFloat(record.totalEarnings.toString()),
      totalDeductions: parseFloat(record.totalDeductions.toString()),
      workingDays: record.workingDays,
      presentDays: parseFloat(record.presentDays.toString()),
      absentDays: parseFloat(record.absentDays.toString()),
      lopDays: record.lopDays ? parseFloat(record.lopDays.toString()) : 0,
      lopAmount: record.lopAmount ? parseFloat(record.lopAmount.toString()) : 0,
      overtimeHours: record.overtimeHours ? parseFloat(record.overtimeHours.toString()) : 0,
      overtimeAmount: record.overtimeAmount ? parseFloat(record.overtimeAmount.toString()) : 0,
      pfDeduction: record.pfDeduction ? parseFloat(record.pfDeduction.toString()) : 0,
      esiDeduction: record.esiDeduction ? parseFloat(record.esiDeduction.toString()) : 0,
      tdsDeduction: record.tdsDeduction ? parseFloat(record.tdsDeduction.toString()) : 0,
      ptDeduction: record.ptDeduction ? parseFloat(record.ptDeduction.toString()) : 0,
      earnings: record.earnings,
      deductions: record.deductions,
      status: record.status,
    })),
  }
}

async function generateStatutoryReport(where: any, period: string) {
  const records = await prisma.payrollRecord.findMany({
    where,
    include: {
      employee: {
        select: {
          employeeCode: true,
          firstName: true,
          lastName: true,
          panNumber: true,
          pfNumber: true,
          esiNumber: true,
        },
      },
    },
  })

  const statutoryData = records.map(record => ({
    employee: record.employee,
    basicSalary: parseFloat(record.basicSalary.toString()),
    grossSalary: parseFloat(record.grossSalary.toString()),
    pfDeduction: record.pfDeduction ? parseFloat(record.pfDeduction.toString()) : 0,
    esiDeduction: record.esiDeduction ? parseFloat(record.esiDeduction.toString()) : 0,
    tdsDeduction: record.tdsDeduction ? parseFloat(record.tdsDeduction.toString()) : 0,
    ptDeduction: record.ptDeduction ? parseFloat(record.ptDeduction.toString()) : 0,
  }))

  const totals = {
    totalPF: statutoryData.reduce((sum, record) => sum + record.pfDeduction, 0),
    totalESI: statutoryData.reduce((sum, record) => sum + record.esiDeduction, 0),
    totalTDS: statutoryData.reduce((sum, record) => sum + record.tdsDeduction, 0),
    totalPT: statutoryData.reduce((sum, record) => sum + record.ptDeduction, 0),
  }

  return {
    records: statutoryData,
    totals,
  }
}

async function generateComparisonReport(data: any) {
  // This would compare multiple periods
  // For now, return a placeholder
  return {
    periods: [data.period],
    comparison: [],
  }
}

async function generateAnalyticsReport(where: any, period: string) {
  const records = await prisma.payrollRecord.findMany({
    where,
    include: {
      employee: {
        include: {
          department: true,
        },
      },
    },
  })

  // Calculate analytics
  const salaries = records.map(r => parseFloat(r.netSalary.toString())).sort((a, b) => a - b)
  const median = salaries.length > 0 ? salaries[Math.floor(salaries.length / 2)] : 0
  const min = salaries.length > 0 ? salaries[0] : 0
  const max = salaries.length > 0 ? salaries[salaries.length - 1] : 0

  return {
    analytics: {
      salaryDistribution: {
        median,
        min,
        max,
        quartiles: {
          q1: salaries.length > 0 ? salaries[Math.floor(salaries.length * 0.25)] : 0,
          q3: salaries.length > 0 ? salaries[Math.floor(salaries.length * 0.75)] : 0,
        },
      },
      departmentAnalysis: records.reduce((acc: any, record) => {
        const dept = record.employee.department.name
        if (!acc[dept]) {
          acc[dept] = {
            count: 0,
            totalSalary: 0,
            avgSalary: 0,
          }
        }
        acc[dept].count++
        acc[dept].totalSalary += parseFloat(record.netSalary.toString())
        acc[dept].avgSalary = acc[dept].totalSalary / acc[dept].count
        return acc
      }, {}),
    },
    records,
  }
}
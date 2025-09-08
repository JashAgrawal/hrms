import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { payrollCalculationEngine } from '@/lib/payroll-service'
import { z } from 'zod'
import { PayrollStatus } from '@prisma/client'

const createPayrollRunSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  employeeIds: z.array(z.string()).optional(), // If not provided, process all active employees
  description: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to view payroll runs
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PayrollStatus | null
    const period = searchParams.get('period')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const payrollRuns = await prisma.payrollRun.findMany({
      where: {
        ...(status && { status }),
        ...(period && { period }),
      },
      include: {
        _count: {
          select: {
            payrollRecords: true,
          },
        },
      },
      orderBy: [
        { period: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
    })

    const total = await prisma.payrollRun.count({
      where: {
        ...(status && { status }),
        ...(period && { period }),
      },
    })

    return NextResponse.json({
      payrollRuns,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('Error fetching payroll runs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payroll runs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create payroll runs
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createPayrollRunSchema.parse(body)

    // Check if payroll run already exists for this period
    const existingRun = await prisma.payrollRun.findUnique({
      where: { period: validatedData.period },
    })

    if (existingRun) {
      return NextResponse.json(
        { error: `Payroll run already exists for period ${validatedData.period}` },
        { status: 400 }
      )
    }

    // Get employee IDs to process
    let employeeIds = validatedData.employeeIds
    if (!employeeIds || employeeIds.length === 0) {
      // Get all active employees
      const activeEmployees = await prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      })
      employeeIds = activeEmployees.map(emp => emp.id)
    }

    if (employeeIds.length === 0) {
      return NextResponse.json(
        { error: 'No employees found to process payroll' },
        { status: 400 }
      )
    }

    // Calculate period dates
    const [year, month] = validatedData.period.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // Last day of the month

    // Create payroll run
    const payrollRun = await prisma.payrollRun.create({
      data: {
        period: validatedData.period,
        startDate,
        endDate,
        status: PayrollStatus.DRAFT,
        processedBy: session.user.id,
      },
    })

    // Process payroll calculations in the background
    // In a real application, this would be done in a background job
    try {
      const calculations = await payrollCalculationEngine.calculateBulkPayroll(
        employeeIds,
        validatedData.period,
        startDate,
        endDate
      )

      // Create payroll records
      const payrollRecords = calculations.map(calc => ({
        employeeId: calc.employeeId,
        payrollRunId: payrollRun.id,
        basicSalary: calc.basicSalary,
        grossSalary: calc.grossSalary,
        netSalary: calc.netSalary,
        totalEarnings: calc.totalEarnings,
        totalDeductions: calc.totalDeductions,
        workingDays: calc.workingDays,
        presentDays: calc.presentDays,
        absentDays: calc.absentDays,
        overtimeHours: calc.overtimeHours || 0,
        overtimeAmount: calc.overtimeAmount || 0,
        lopDays: calc.lopDays || 0,
        lopAmount: calc.lopAmount || 0,
        pfDeduction: calc.statutoryDeductions.pf,
        esiDeduction: calc.statutoryDeductions.esi,
        tdsDeduction: calc.statutoryDeductions.tds,
        ptDeduction: calc.statutoryDeductions.pt,
        earnings: calc.components.filter(c => c.type === 'EARNING').map(c => ({
          componentId: c.componentId,
          componentName: c.componentName,
          componentCode: c.componentCode,
          baseValue: c.baseValue,
          calculatedValue: c.calculatedValue,
          isProrated: c.isProrated,
        })),
        deductions: calc.components.filter(c => c.type === 'DEDUCTION').map(c => ({
          componentId: c.componentId,
          componentName: c.componentName,
          componentCode: c.componentCode,
          baseValue: c.baseValue,
          calculatedValue: c.calculatedValue,
          isProrated: c.isProrated,
        })),
        status: 'CALCULATED' as const,
      }))

      await prisma.payrollRecord.createMany({
        data: payrollRecords,
      })

      // Update payroll run with totals
      const totalGross = calculations.reduce((sum, calc) => sum + calc.grossSalary, 0)
      const totalNet = calculations.reduce((sum, calc) => sum + calc.netSalary, 0)
      const totalDeductions = calculations.reduce((sum, calc) => sum + calc.totalDeductions, 0)

      await prisma.payrollRun.update({
        where: { id: payrollRun.id },
        data: {
          status: PayrollStatus.COMPLETED,
          processedAt: new Date(),
          totalGross,
          totalNet,
          totalDeductions,
          employeeCount: calculations.length,
        },
      })

      // Fetch the updated payroll run with records
      const updatedPayrollRun = await prisma.payrollRun.findUnique({
        where: { id: payrollRun.id },
        include: {
          payrollRecords: {
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
            },
          },
          _count: {
            select: {
              payrollRecords: true,
            },
          },
        },
      })

      return NextResponse.json(updatedPayrollRun, { status: 201 })
    } catch (calculationError) {
      console.error('Error during payroll calculation:', calculationError)
      
      // Update payroll run status to failed
      await prisma.payrollRun.update({
        where: { id: payrollRun.id },
        data: {
          status: PayrollStatus.FAILED,
        },
      })

      return NextResponse.json(
        { error: 'Payroll calculation failed', details: calculationError },
        { status: 500 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating payroll run:', error)
    return NextResponse.json(
      { error: 'Failed to create payroll run' },
      { status: 500 }
    )
  }
}
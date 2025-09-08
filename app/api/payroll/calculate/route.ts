import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { payrollCalculationEngine } from '@/lib/payroll-service'
import { z } from 'zod'

const calculatePayrollSchema = z.object({
  employeeIds: z.array(z.string()).min(1, 'At least one employee ID is required'),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

const calculateSingleEmployeeSchema = z.object({
  employeeId: z.string(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to calculate payroll
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const single = searchParams.get('single') === 'true'

    if (single) {
      // Calculate for single employee
      const validatedData = calculateSingleEmployeeSchema.parse(body)
      
      const result = await payrollCalculationEngine.calculateEmployeePayroll({
        employeeId: validatedData.employeeId,
        period: validatedData.period,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        workingDays: payrollCalculationEngine.getWorkingDaysInMonth(validatedData.period),
      })

      return NextResponse.json(result)
    } else {
      // Calculate for multiple employees
      const validatedData = calculatePayrollSchema.parse(body)
      
      const results = await payrollCalculationEngine.calculateBulkPayroll(
        validatedData.employeeIds,
        validatedData.period,
        new Date(validatedData.startDate),
        new Date(validatedData.endDate)
      )

      return NextResponse.json({
        period: validatedData.period,
        totalEmployees: validatedData.employeeIds.length,
        successfulCalculations: results.length,
        failedCalculations: validatedData.employeeIds.length - results.length,
        results,
      })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error calculating payroll:', error)
    return NextResponse.json(
      { error: 'Failed to calculate payroll' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { generateMonthlyPetrolExpense } from '@/lib/utils/expense-policy'

const generateMonthlyExpenseSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required').optional(),
  month: z.number().int().min(1, 'Month must be 1-12').max(12, 'Month must be 1-12'),
  year: z.number().int().min(2020, 'Year too old').max(2030, 'Year too far in future'),
})

const bulkGenerateSchema = z.object({
  month: z.number().int().min(1, 'Month must be 1-12').max(12, 'Month must be 1-12'),
  year: z.number().int().min(2020, 'Year too old').max(2030, 'Year too far in future'),
  employeeIds: z.array(z.string()).optional(), // If not provided, generate for all field employees
})

// POST /api/petrol-expenses/generate - Generate monthly petrol expense
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to generate petrol expenses
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const body = await request.json()
    const { employeeId, month, year } = generateMonthlyExpenseSchema.parse(body)

    // Determine target employee
    let targetEmployeeId = employeeId

    if (!targetEmployeeId) {
      // If no employeeId provided, use current user's employee ID (for self-generation)
      if (user.role === 'EMPLOYEE') {
        targetEmployeeId = user.employee.id
      } else {
        return NextResponse.json(
          { error: 'Employee ID is required for non-employee users' },
          { status: 400 }
        )
      }
    }

    // Check permissions - employees can only generate for themselves
    if (user.role === 'EMPLOYEE' && targetEmployeeId !== user.employee.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate that the employee exists and is a field employee
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        employeeType: true,
      },
    })

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (targetEmployee.employeeType !== 'FIELD_EMPLOYEE') {
      return NextResponse.json(
        { error: 'Petrol expenses can only be generated for field employees' },
        { status: 400 }
      )
    }

    // Generate monthly petrol expense
    await generateMonthlyPetrolExpense(targetEmployeeId, month, year)

    // Fetch the generated expense
    const generatedExpense = await prisma.monthlyPetrolExpense.findUnique({
      where: {
        employeeId_month_year: {
          employeeId: targetEmployeeId,
          month,
          year,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        expenseClaim: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
    })

    return NextResponse.json({
      message: 'Monthly petrol expense generated successfully',
      expense: generatedExpense,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error generating monthly petrol expense:', error)
    return NextResponse.json(
      { error: 'Failed to generate monthly petrol expense' },
      { status: 500 }
    )
  }
}
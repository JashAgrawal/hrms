import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { generateMonthlyPetrolExpense } from '@/lib/utils/expense-policy'

const bulkGenerateSchema = z.object({
  month: z.number().int().min(1, 'Month must be 1-12').max(12, 'Month must be 1-12'),
  year: z.number().int().min(2020, 'Year too old').max(2030, 'Year too far in future'),
  employeeIds: z.array(z.string()).optional(), // If not provided, generate for all field employees
  departmentIds: z.array(z.string()).optional(), // Filter by departments
})

// POST /api/petrol-expenses/bulk-generate - Generate monthly petrol expenses for multiple employees
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to bulk generate petrol expenses (admin/finance/hr)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['ADMIN', 'FINANCE', 'HR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { month, year, employeeIds, departmentIds } = bulkGenerateSchema.parse(body)

    // Build employee filter
    const employeeFilter: any = {
      employeeType: 'FIELD',
      status: 'ACTIVE',
    }

    if (employeeIds && employeeIds.length > 0) {
      employeeFilter.id = { in: employeeIds }
    }

    if (departmentIds && departmentIds.length > 0) {
      employeeFilter.departmentId = { in: departmentIds }
    }

    // Get all field employees matching the criteria
    const fieldEmployees = await prisma.employee.findMany({
      where: employeeFilter,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (fieldEmployees.length === 0) {
      return NextResponse.json(
        { error: 'No field employees found matching the criteria' },
        { status: 404 }
      )
    }

    // Generate expenses for each employee
    const results = {
      total: fieldEmployees.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ employeeId: string; employeeName: string; error: string }>,
      generated: [] as Array<{ employeeId: string; employeeName: string; amount: number }>,
    }

    for (const employee of fieldEmployees) {
      try {
        // Check if expense already exists
        const existingExpense = await prisma.monthlyPetrolExpense.findUnique({
          where: {
            employeeId_month_year: {
              employeeId: employee.id,
              month,
              year,
            },
          },
        })

        if (existingExpense) {
          results.errors.push({
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            error: 'Monthly expense already exists',
          })
          results.failed++
          continue
        }

        await generateMonthlyPetrolExpense(employee.id, month, year)

        // Get the generated expense amount
        const generatedExpense = await prisma.monthlyPetrolExpense.findUnique({
          where: {
            employeeId_month_year: {
              employeeId: employee.id,
              month,
              year,
            },
          },
          select: { totalAmount: true },
        })

        results.generated.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          amount: generatedExpense?.totalAmount.toNumber() || 0,
        })
        results.successful++
      } catch (error) {
        console.error(`Error generating petrol expense for employee ${employee.id}:`, error)
        results.errors.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        results.failed++
      }
    }

    return NextResponse.json({
      message: `Bulk generation completed: ${results.successful} successful, ${results.failed} failed`,
      results,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error in bulk petrol expense generation:', error)
    return NextResponse.json(
      { error: 'Failed to bulk generate petrol expenses' },
      { status: 500 }
    )
  }
}
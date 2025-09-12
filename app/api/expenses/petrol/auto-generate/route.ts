import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateMonthlyPetrolExpense } from '@/lib/utils/expense-policy'
import { z } from 'zod'

const autoGenerateSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2030),
  employeeIds: z.array(z.string()).optional(), // If not provided, generate for all field employees
  forceRegenerate: z.boolean().default(false) // Force regenerate even if already exists
})

// POST /api/expenses/petrol/auto-generate - Auto-generate monthly petrol expenses
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only ADMIN, HR, and FINANCE can auto-generate
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const canAutoGenerate = ['ADMIN', 'HR', 'FINANCE'].includes(user?.role || '')
    
    if (!canAutoGenerate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = autoGenerateSchema.parse(body)

    // Get field employees to process
    let employeeIds = validatedData.employeeIds
    
    if (!employeeIds || employeeIds.length === 0) {
      // Get all active field employees
      const fieldEmployees = await prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          employeeType: 'FIELD_EMPLOYEE'
        },
        select: { id: true }
      })
      
      employeeIds = fieldEmployees.map(emp => emp.id)
    }

    if (employeeIds.length === 0) {
      return NextResponse.json({
        message: 'No field employees found to process',
        processed: 0,
        skipped: 0,
        errors: []
      })
    }

    const results = {
      processed: 0,
      skipped: 0,
      errors: [] as Array<{ employeeId: string; error: string }>
    }

    // Process each employee
    for (const employeeId of employeeIds) {
      try {
        // Check if monthly expense already exists
        const existingExpense = await prisma.monthlyPetrolExpense.findUnique({
          where: {
            employeeId_month_year: {
              employeeId,
              month: validatedData.month,
              year: validatedData.year
            }
          }
        })

        if (existingExpense && !validatedData.forceRegenerate) {
          results.skipped += 1
          continue
        }

        // If force regenerate, delete existing expense and claim
        if (existingExpense && validatedData.forceRegenerate) {
          if (existingExpense.expenseClaimId) {
            // Delete related expense claim and its approvals
            await prisma.expenseApproval.deleteMany({
              where: { expenseId: existingExpense.expenseClaimId }
            })
            
            await prisma.expenseClaim.delete({
              where: { id: existingExpense.expenseClaimId }
            })
          }
          
          await prisma.monthlyPetrolExpense.delete({
            where: { id: existingExpense.id }
          })
        }

        // Generate monthly petrol expense
        await generateMonthlyPetrolExpense(
          employeeId,
          validatedData.month,
          validatedData.year
        )

        results.processed += 1
      } catch (error) {
        console.error(`Error processing employee ${employeeId}:`, error)
        results.errors.push({
          employeeId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PETROL_EXPENSE_AUTO_GENERATED',
        resource: 'MONTHLY_PETROL_EXPENSE',
        details: {
          month: validatedData.month,
          year: validatedData.year,
          employeeCount: employeeIds.length,
          processed: results.processed,
          skipped: results.skipped,
          errors: results.errors.length
        }
      }
    })

    return NextResponse.json({
      message: `Auto-generation completed for ${validatedData.month}/${validatedData.year}`,
      ...results,
      totalEmployees: employeeIds.length
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error auto-generating petrol expenses:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/expenses/petrol/auto-generate - Get auto-generation status and history
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const canView = ['ADMIN', 'HR', 'FINANCE'].includes(user?.role || '')
    
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined

    // Get monthly petrol expense summary
    const whereClause: any = { year }
    if (month) {
      whereClause.month = month
    }

    const monthlyExpenses = await prisma.monthlyPetrolExpense.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: {
              select: { name: true }
            }
          }
        },
        expenseClaim: {
          select: {
            id: true,
            status: true,
            approvedAt: true,
            reimbursedAt: true
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { employee: { employeeCode: 'asc' } }
      ]
    })

    // Get field employees count for reference
    const totalFieldEmployees = await prisma.employee.count({
      where: {
        status: 'ACTIVE',
        employeeType: 'FIELD_EMPLOYEE'
      }
    })

    // Group by month for summary
    const monthlyGrouped = monthlyExpenses.reduce((acc, expense) => {
      const key = `${expense.year}-${expense.month.toString().padStart(2, '0')}`
      
      if (!acc[key]) {
        acc[key] = {
          year: expense.year,
          month: expense.month,
          totalEmployees: 0,
          totalDistance: 0,
          totalAmount: 0,
          statusBreakdown: {
            PENDING: 0,
            APPROVED: 0,
            REJECTED: 0,
            REIMBURSED: 0
          }
        }
      }

      acc[key].totalEmployees += 1
      acc[key].totalDistance += expense.totalDistance.toNumber()
      acc[key].totalAmount += expense.totalAmount.toNumber()
      
      if (expense.expenseClaim) {
        acc[key].statusBreakdown[expense.expenseClaim.status] += 1
      }

      return acc
    }, {} as Record<string, any>)

    // Get recent audit logs for auto-generation
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'PETROL_EXPENSE_AUTO_GENERATED',
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({
      summary: {
        totalFieldEmployees,
        monthlyBreakdown: Object.values(monthlyGrouped)
      },
      expenses: monthlyExpenses,
      recentGenerations: auditLogs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        user: log.user,
        details: log.details
      }))
    })
  } catch (error) {
    console.error('Error fetching auto-generation status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
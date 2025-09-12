import { prisma } from '@/lib/prisma'
import { generateMonthlyPetrolExpense } from '@/lib/utils/expense-policy'

export interface PetrolExpenseJobResult {
  success: boolean
  processed: number
  errors: Array<{ employeeId: string; error: string }>
  summary: {
    totalEmployees: number
    successful: number
    failed: number
    skipped: number
  }
}

/**
 * Automatically generate monthly petrol expenses for all field employees
 * This function should be called at the beginning of each month
 */
export async function generateMonthlyPetrolExpensesForAllEmployees(
  month?: number,
  year?: number
): Promise<PetrolExpenseJobResult> {
  const result: PetrolExpenseJobResult = {
    success: false,
    processed: 0,
    errors: [],
    summary: {
      totalEmployees: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    },
  }

  try {
    // Default to previous month if not specified
    const now = new Date()
    const targetMonth = month || (now.getMonth() === 0 ? 12 : now.getMonth())
    const targetYear = year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())

    console.log(`Starting monthly petrol expense generation for ${targetMonth}/${targetYear}`)

    // Get all active field employees
    const fieldEmployees = await prisma.employee.findMany({
      where: {
        employeeType: 'FIELD_EMPLOYEE',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        department: {
          select: {
            name: true,
          },
        },
      },
    })

    result.summary.totalEmployees = fieldEmployees.length

    if (fieldEmployees.length === 0) {
      console.log('No field employees found')
      result.success = true
      return result
    }

    console.log(`Found ${fieldEmployees.length} field employees`)

    // Process each employee
    for (const employee of fieldEmployees) {
      try {
        // Check if monthly expense already exists
        const existingExpense = await prisma.monthlyPetrolExpense.findUnique({
          where: {
            employeeId_month_year: {
              employeeId: employee.id,
              month: targetMonth,
              year: targetYear,
            },
          },
        })

        if (existingExpense) {
          console.log(`Skipping ${employee.employeeCode} - expense already exists`)
          result.summary.skipped++
          continue
        }

        // Check if employee has any distance records for the month
        const startDate = new Date(targetYear, targetMonth - 1, 1)
        const endDate = new Date(targetYear, targetMonth, 0)

        const distanceRecords = await prisma.dailyDistanceRecord.findMany({
          where: {
            employeeId: employee.id,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            totalDistance: true,
          },
        })

        const totalDistance = distanceRecords.reduce(
          (sum, record) => sum + record.totalDistance.toNumber(),
          0
        )

        if (totalDistance === 0) {
          console.log(`Skipping ${employee.employeeCode} - no distance traveled`)
          result.summary.skipped++
          continue
        }

        // Generate monthly petrol expense
        await generateMonthlyPetrolExpense(employee.id, targetMonth, targetYear)

        console.log(`Generated petrol expense for ${employee.employeeCode}: ${totalDistance}km`)
        result.summary.successful++
        result.processed++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error processing employee ${employee.employeeCode}:`, error)
        
        result.errors.push({
          employeeId: employee.id,
          error: errorMessage,
        })
        result.summary.failed++
      }
    }

    result.success = true
    console.log(`Petrol expense generation completed: ${result.summary.successful} successful, ${result.summary.failed} failed, ${result.summary.skipped} skipped`)

    return result
  } catch (error) {
    console.error('Error in petrol expense generation job:', error)
    result.errors.push({
      employeeId: 'SYSTEM',
      error: error instanceof Error ? error.message : 'System error',
    })
    return result
  }
}

/**
 * Generate petrol expenses for a specific department
 */
export async function generatePetrolExpensesForDepartment(
  departmentId: string,
  month: number,
  year: number
): Promise<PetrolExpenseJobResult> {
  const result: PetrolExpenseJobResult = {
    success: false,
    processed: 0,
    errors: [],
    summary: {
      totalEmployees: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    },
  }

  try {
    // Get field employees in the department
    const fieldEmployees = await prisma.employee.findMany({
      where: {
        departmentId,
        employeeType: 'FIELD_EMPLOYEE',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
      },
    })

    result.summary.totalEmployees = fieldEmployees.length

    for (const employee of fieldEmployees) {
      try {
        await generateMonthlyPetrolExpense(employee.id, month, year)
        result.summary.successful++
        result.processed++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push({
          employeeId: employee.id,
          error: errorMessage,
        })
        result.summary.failed++
      }
    }

    result.success = true
    return result
  } catch (error) {
    console.error('Error generating petrol expenses for department:', error)
    result.errors.push({
      employeeId: 'SYSTEM',
      error: error instanceof Error ? error.message : 'System error',
    })
    return result
  }
}

/**
 * Clean up old petrol expense data (older than specified months)
 */
export async function cleanupOldPetrolExpenses(monthsToKeep: number = 24): Promise<void> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep)
    
    const cutoffYear = cutoffDate.getFullYear()
    const cutoffMonth = cutoffDate.getMonth() + 1

    // Delete old monthly petrol expenses (and related expense claims will be handled by cascade)
    const deletedCount = await prisma.monthlyPetrolExpense.deleteMany({
      where: {
        OR: [
          { year: { lt: cutoffYear } },
          {
            year: cutoffYear,
            month: { lt: cutoffMonth },
          },
        ],
      },
    })

    console.log(`Cleaned up ${deletedCount.count} old petrol expense records`)
  } catch (error) {
    console.error('Error cleaning up old petrol expenses:', error)
    throw error
  }
}

/**
 * Get petrol expense generation statistics
 */
export async function getPetrolExpenseStats(month: number, year: number) {
  try {
    const stats = await prisma.monthlyPetrolExpense.groupBy({
      by: ['status'],
      where: {
        month,
        year,
      },
      _count: {
        id: true,
      },
      _sum: {
        totalAmount: true,
        totalDistance: true,
      },
    })

    const totalEmployees = await prisma.employee.count({
      where: {
        employeeType: 'FIELD_EMPLOYEE',
        status: 'ACTIVE',
      },
    })

    return {
      month,
      year,
      totalFieldEmployees: totalEmployees,
      stats: stats.map(stat => ({
        status: stat.status,
        count: stat._count.id,
        totalAmount: stat._sum.totalAmount?.toNumber() || 0,
        totalDistance: stat._sum.totalDistance?.toNumber() || 0,
      })),
    }
  } catch (error) {
    console.error('Error getting petrol expense stats:', error)
    throw error
  }
}
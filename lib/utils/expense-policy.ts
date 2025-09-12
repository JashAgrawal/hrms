import { prisma } from '@/lib/prisma'

export interface ExpensePolicyValidationResult {
  isValid: boolean
  violations: string[]
  requiresApproval: boolean
  approvalLevels: number
}

export async function validateExpensePolicy(
  categoryId: string,
  amount: number,
  employeeId: string,
  expenseDate: Date,
  hasReceipt: boolean = false,
  hasLocation: boolean = false
): Promise<ExpensePolicyValidationResult> {
  const violations: string[] = []
  let requiresApproval = false
  let approvalLevels = 1

  try {
    // Get category with policy rules
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      include: {
        policyRules: {
          where: { isActive: true },
        },
      },
    })

    if (!category || !category.isActive) {
      violations.push('Invalid or inactive expense category')
      return {
        isValid: false,
        violations,
        requiresApproval: false,
        approvalLevels: 0,
      }
    }

    requiresApproval = category.requiresApproval
    approvalLevels = category.approvalLevels

    // Check category max amount
    if (category.maxAmount && amount > Number(category.maxAmount)) {
      violations.push(`Amount exceeds category limit of ${category.maxAmount}`)
    }

    // Check if receipt is required
    if (category.requiresReceipt && !hasReceipt) {
      violations.push('Receipt is required for this expense category')
    }

    // Validate policy rules
    for (const rule of category.policyRules) {
      const ruleValue = rule.ruleValue as any

      switch (rule.ruleType) {
        case 'AMOUNT_LIMIT':
          if (ruleValue.maxAmount && amount > ruleValue.maxAmount) {
            violations.push(`Amount exceeds policy limit of ${ruleValue.maxAmount}`)
          }
          if (ruleValue.minAmount && amount < ruleValue.minAmount) {
            violations.push(`Amount below minimum limit of ${ruleValue.minAmount}`)
          }
          break

        case 'RECEIPT_REQUIRED':
          if (ruleValue.required && !hasReceipt) {
            violations.push('Receipt/bill is required by policy')
          }
          break

        case 'GPS_REQUIRED':
          if (ruleValue.required && !hasLocation) {
            violations.push('GPS location is required by policy')
          }
          break

        case 'FREQUENCY_LIMIT':
          // Check frequency limits (daily, weekly, monthly)
          if (ruleValue.period && ruleValue.maxCount) {
            const frequencyViolation = await checkFrequencyLimit(
              employeeId,
              categoryId,
              expenseDate,
              ruleValue.period,
              ruleValue.maxCount
            )
            if (frequencyViolation) {
              violations.push(frequencyViolation)
            }
          }
          break

        case 'APPROVAL_REQUIRED':
          if (ruleValue.required) {
            requiresApproval = true
            if (ruleValue.levels) {
              approvalLevels = Math.max(approvalLevels, ruleValue.levels)
            }
          }
          break
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      requiresApproval,
      approvalLevels,
    }
  } catch (error) {
    console.error('Error validating expense policy:', error)
    return {
      isValid: false,
      violations: ['Error validating expense policy'],
      requiresApproval: false,
      approvalLevels: 0,
    }
  }
}

async function checkFrequencyLimit(
  employeeId: string,
  categoryId: string,
  expenseDate: Date,
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  maxCount: number
): Promise<string | null> {
  let startDate: Date
  let endDate: Date

  switch (period) {
    case 'DAILY':
      startDate = new Date(expenseDate)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(expenseDate)
      endDate.setHours(23, 59, 59, 999)
      break

    case 'WEEKLY':
      startDate = new Date(expenseDate)
      startDate.setDate(expenseDate.getDate() - expenseDate.getDay())
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6)
      endDate.setHours(23, 59, 59, 999)
      break

    case 'MONTHLY':
      startDate = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1)
      endDate = new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 0)
      endDate.setHours(23, 59, 59, 999)
      break

    default:
      return null
  }

  const existingCount = await prisma.expenseClaim.count({
    where: {
      employeeId,
      categoryId,
      expenseDate: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        not: 'CANCELLED',
      },
    },
  })

  if (existingCount >= maxCount) {
    return `Frequency limit exceeded: Maximum ${maxCount} claims per ${period.toLowerCase()} allowed`
  }

  return null
}

export async function getApprovalHierarchy(
  employeeId: string,
  approvalLevels: number
): Promise<string[]> {
  const approvers: string[] = []

  try {
    // Get employee with reporting hierarchy
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        reportingTo: true,
        manager: {
          select: {
            id: true,
            userId: true,
            reportingTo: true,
            manager: {
              select: {
                id: true,
                userId: true,
                reportingTo: true,
                manager: {
                  select: {
                    id: true,
                    userId: true,
                    reportingTo: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!employee) {
      return approvers
    }

    // Build approval hierarchy
    let currentManager = employee.manager
    let level = 1

    while (currentManager && level <= approvalLevels) {
      approvers.push(currentManager.userId)
      
      // Fetch the next level manager if needed
      if (currentManager.reportingTo && level < approvalLevels) {
        const nextManager = await prisma.employee.findUnique({
          where: { id: currentManager.reportingTo },
          select: {
            id: true,
            userId: true,
            reportingTo: true,
          },
        })
        currentManager = nextManager as any
      } else {
        currentManager = null
      }
      
      level++
    }

    // If we don't have enough approvers in the hierarchy, add HR/Finance roles
    if (approvers.length < approvalLevels) {
      const additionalApprovers = await prisma.user.findMany({
        where: {
          role: { in: ['HR', 'FINANCE', 'ADMIN'] },
          isActive: true,
          id: { notIn: approvers },
        },
        select: { id: true },
        take: approvalLevels - approvers.length,
      })

      approvers.push(...additionalApprovers.map(user => user.id))
    }

    return approvers.slice(0, approvalLevels)
  } catch (error) {
    console.error('Error getting approval hierarchy:', error)
    return approvers
  }
}

export async function createExpenseApprovals(
  expenseId: string,
  approvers: string[]
): Promise<void> {
  try {
    const approvals = approvers.map((approverId, index) => ({
      expenseId,
      approverId,
      level: index + 1,
      status: 'PENDING' as const,
    }))

    await prisma.expenseApproval.createMany({
      data: approvals,
    })
  } catch (error) {
    console.error('Error creating expense approvals:', error)
    throw error
  }
}

export async function calculatePetrolExpense(
  distanceKm: number,
  ratePerKm?: number
): Promise<{ amount: number; rate: number }> {
  try {
    let rate = ratePerKm

    if (!rate) {
      // Get current petrol rate configuration
      const config = await prisma.petrolExpenseConfig.findFirst({
        where: {
          isActive: true,
          effectiveFrom: { lte: new Date() },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date() } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      })

      if (!config) {
        throw new Error('No active petrol expense configuration found')
      }

      rate = config.ratePerKm.toNumber()
    }

    const amount = distanceKm * rate

    return { amount, rate }
  } catch (error) {
    console.error('Error calculating petrol expense:', error)
    throw error
  }
}

export async function generateMonthlyPetrolExpense(
  employeeId: string,
  month: number,
  year: number
): Promise<void> {
  try {
    // Check if monthly expense already exists
    const existingExpense = await prisma.monthlyPetrolExpense.findUnique({
      where: {
        employeeId_month_year: {
          employeeId,
          month,
          year,
        },
      },
    })

    if (existingExpense) {
      console.log(`Monthly petrol expense already exists for employee ${employeeId} for ${month}/${year}`)
      return
    }

    // Get total distance for the month from daily distance records
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    const dailyRecords = await prisma.dailyDistanceRecord.findMany({
      where: {
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    })

    const totalDistance = dailyRecords.reduce(
      (sum, record) => sum + record.totalDistance.toNumber(),
      0
    )

    if (totalDistance === 0) {
      console.log(`No distance traveled for employee ${employeeId} in ${month}/${year}`)
      return
    }

    // Calculate petrol expense
    const { amount, rate } = await calculatePetrolExpense(totalDistance)

    // Get petrol expense category
    const petrolCategory = await prisma.expenseCategory.findFirst({
      where: {
        code: 'PETROL',
        isActive: true,
      },
    })

    if (!petrolCategory) {
      throw new Error('Petrol expense category not found')
    }

    // Create monthly petrol expense record
    const monthlyExpense = await prisma.monthlyPetrolExpense.create({
      data: {
        employeeId,
        month,
        year,
        totalDistance,
        totalAmount: amount,
        ratePerKm: rate,
        status: 'PENDING',
        autoGenerated: true,
      },
    })

    // Create expense claim
    const expenseClaim = await prisma.expenseClaim.create({
      data: {
        employeeId,
        categoryId: petrolCategory.id,
        title: `Petrol Expense - ${month}/${year}`,
        description: `Auto-generated petrol expense for ${totalDistance}km traveled`,
        amount,
        currency: 'INR',
        expenseDate: endDate,
        isPetrolExpense: true,
        distanceTraveled: totalDistance,
        status: 'PENDING',
      },
    })

    // Link expense claim to monthly expense
    await prisma.monthlyPetrolExpense.update({
      where: { id: monthlyExpense.id },
      data: { expenseClaimId: expenseClaim.id },
    })

    // Create approvals if required
    if (petrolCategory.requiresApproval) {
      const approvers = await getApprovalHierarchy(employeeId, petrolCategory.approvalLevels)
      await createExpenseApprovals(expenseClaim.id, approvers)
    }

    console.log(`Generated monthly petrol expense for employee ${employeeId}: ${totalDistance}km = ${amount} INR`)
  } catch (error) {
    console.error('Error generating monthly petrol expense:', error)
    throw error
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for policy validation request
const validatePolicySchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  amount: z.number().positive('Amount must be positive'),
  expenseDate: z.string().transform((str) => new Date(str)),
  hasReceipt: z.boolean().default(false)
})

// POST /api/expenses/validate-policy - Validate expense against policy rules
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = validatePolicySchema.parse(body)

    // Get employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Get expense category with policy rules
    const category = await prisma.expenseCategory.findUnique({
      where: { id: validatedData.categoryId },
      include: {
        policyRules: {
          where: { isActive: true }
        }
      }
    })

    if (!category || !category.isActive) {
      return NextResponse.json({ error: 'Invalid expense category' }, { status: 400 })
    }

    const violations = []
    const warnings = []

    // Check amount limit
    if (category.maxAmount && validatedData.amount > category.maxAmount.toNumber()) {
      violations.push({
        rule: 'AMOUNT_LIMIT',
        severity: 'ERROR',
        message: `Amount ₹${validatedData.amount} exceeds maximum limit of ₹${category.maxAmount}`,
        maxAmount: category.maxAmount.toNumber(),
        currentAmount: validatedData.amount
      })
    }

    // Check receipt requirement
    if (category.requiresReceipt && !validatedData.hasReceipt) {
      violations.push({
        rule: 'RECEIPT_REQUIRED',
        severity: 'ERROR',
        message: 'Receipt is required for this expense category'
      })
    }

    // Check policy rules
    for (const rule of category.policyRules) {
      switch (rule.ruleType) {
        case 'AMOUNT_LIMIT':
          const ruleConfig = rule.ruleValue as any
          if (ruleConfig.maxAmount && validatedData.amount > ruleConfig.maxAmount) {
            violations.push({
              rule: 'POLICY_AMOUNT_LIMIT',
              severity: 'ERROR',
              message: `Amount exceeds policy limit of ₹${ruleConfig.maxAmount}`,
              maxAmount: ruleConfig.maxAmount,
              currentAmount: validatedData.amount
            })
          }
          break

        case 'FREQUENCY_LIMIT':
          // Check frequency limits (e.g., max 5 claims per month)
          const freqConfig = rule.ruleValue as any
          if (freqConfig.maxPerMonth) {
            const startOfMonth = new Date(validatedData.expenseDate.getFullYear(), validatedData.expenseDate.getMonth(), 1)
            const endOfMonth = new Date(validatedData.expenseDate.getFullYear(), validatedData.expenseDate.getMonth() + 1, 0)

            const monthlyCount = await prisma.expenseClaim.count({
              where: {
                employeeId: employee.id,
                categoryId: validatedData.categoryId,
                expenseDate: {
                  gte: startOfMonth,
                  lte: endOfMonth
                },
                status: {
                  not: 'REJECTED'
                }
              }
            })

            if (monthlyCount >= freqConfig.maxPerMonth) {
              violations.push({
                rule: 'FREQUENCY_LIMIT',
                severity: 'ERROR',
                message: `Monthly limit of ${freqConfig.maxPerMonth} claims exceeded`,
                maxPerMonth: freqConfig.maxPerMonth,
                currentCount: monthlyCount
              })
            } else if (monthlyCount >= freqConfig.maxPerMonth * 0.8) {
              warnings.push({
                rule: 'FREQUENCY_WARNING',
                severity: 'WARNING',
                message: `Approaching monthly limit (${monthlyCount}/${freqConfig.maxPerMonth} claims used)`
              })
            }
          }
          break

        case 'APPROVAL_REQUIRED':
          const approvalConfig = rule.ruleValue as any
          if (approvalConfig.minAmount && validatedData.amount >= approvalConfig.minAmount) {
            warnings.push({
              rule: 'APPROVAL_REQUIRED',
              severity: 'INFO',
              message: `This expense requires approval (amount ≥ ₹${approvalConfig.minAmount})`
            })
          }
          break
      }
    }

    // Calculate approval levels required
    let approvalLevels = category.approvalLevels
    for (const rule of category.policyRules) {
      if (rule.ruleType === 'APPROVAL_REQUIRED') {
        const approvalConfig = rule.ruleValue as any
        if (approvalConfig.levels && validatedData.amount >= (approvalConfig.minAmount || 0)) {
          approvalLevels = Math.max(approvalLevels, approvalConfig.levels)
        }
      }
    }

    const result = {
      isValid: violations.length === 0,
      violations,
      warnings,
      category: {
        id: category.id,
        name: category.name,
        requiresReceipt: category.requiresReceipt,
        requiresApproval: category.requiresApproval,
        approvalLevels,
        maxAmount: category.maxAmount?.toNumber()
      },
      recommendations: [] as string[]
    }

    // Add recommendations
    if (validatedData.amount > 1000 && !validatedData.hasReceipt) {
      result.recommendations.push('Consider uploading a receipt for expenses above ₹1000')
    }

    if (violations.length > 0) {
      result.recommendations.push('Please review and correct the policy violations before submitting')
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error validating expense policy:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
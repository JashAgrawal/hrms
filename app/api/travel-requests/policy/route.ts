import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const validatePolicySchema = z.object({
  destination: z.string(),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  estimatedCost: z.number().positive(),
  travelMode: z.enum(['FLIGHT', 'TRAIN', 'BUS', 'CAR', 'TAXI', 'OTHER']),
  advanceRequired: z.boolean(),
  advanceAmount: z.number().optional(),
})

// POST /api/travel-requests/policy - Validate travel request against policy
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { 
        employee: {
          include: {
            department: true,
          }
        }
      },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = validatePolicySchema.parse(body)

    const violations: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []

    // 1. Advance Notice Policy
    const daysDifference = Math.ceil((validatedData.startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    const isInternational = !validatedData.destination.toLowerCase().includes('india')
    const minDays = isInternational ? 7 : 3

    if (daysDifference < minDays) {
      violations.push(`Travel requests must be submitted at least ${minDays} days in advance`)
    } else if (daysDifference < minDays + 2) {
      warnings.push(`Consider submitting travel requests earlier for better rates`)
    }

    // 2. Cost Limits Based on Employee Grade
    const costLimits = {
      'L1': { domestic: 25000, international: 75000 },
      'L2': { domestic: 35000, international: 100000 },
      'L3': { domestic: 50000, international: 125000 },
      'MANAGER': { domestic: 75000, international: 150000 },
      'SENIOR_MANAGER': { domestic: 100000, international: 200000 },
    }

    const employeeGrade = user.employee.salaryGrade || 'L1'
    const limits = costLimits[employeeGrade as keyof typeof costLimits] || costLimits.L1
    const maxCost = isInternational ? limits.international : limits.domestic

    if (validatedData.estimatedCost > maxCost) {
      violations.push(`Estimated cost (₹${validatedData.estimatedCost.toLocaleString()}) exceeds limit for ${employeeGrade} grade (₹${maxCost.toLocaleString()})`)
    } else if (validatedData.estimatedCost > maxCost * 0.8) {
      warnings.push(`Estimated cost is approaching the limit for your grade`)
    }

    // 3. Advance Amount Policy
    if (validatedData.advanceRequired && validatedData.advanceAmount) {
      const maxAdvance = validatedData.estimatedCost * 0.5
      if (validatedData.advanceAmount > maxAdvance) {
        violations.push(`Advance amount (₹${validatedData.advanceAmount.toLocaleString()}) cannot exceed 50% of estimated cost (₹${maxAdvance.toLocaleString()})`)
      }
    }

    // 4. Travel Mode Recommendations
    const tripDuration = Math.ceil((validatedData.endDate.getTime() - validatedData.startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (isInternational && validatedData.travelMode !== 'FLIGHT') {
      recommendations.push('Flight is recommended for international travel')
    }
    
    if (!isInternational && tripDuration <= 1 && validatedData.travelMode === 'FLIGHT') {
      recommendations.push('Consider train or bus for short domestic trips to reduce costs')
    }

    // 5. Weekend Travel Policy
    const startDay = validatedData.startDate.getDay()
    const endDay = validatedData.endDate.getDay()
    
    if (startDay === 0 || startDay === 6 || endDay === 0 || endDay === 6) {
      warnings.push('Travel on weekends may require additional approvals')
    }

    // 6. Frequent Travel Check
    const recentTravelCount = await prisma.travelRequest.count({
      where: {
        employeeId: user.employee.id,
        startDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
        status: {
          in: ['APPROVED', 'COMPLETED'],
        },
      },
    })

    if (recentTravelCount >= 3) {
      warnings.push('You have had multiple trips in the last 30 days. Consider consolidating travel if possible.')
    }

    // 7. Budget Utilization Check
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const monthlyTravelSpend = await prisma.travelRequest.aggregate({
      where: {
        employeeId: user.employee.id,
        startDate: {
          gte: currentMonthStart,
        },
        status: {
          in: ['APPROVED', 'COMPLETED'],
        },
      },
      _sum: {
        estimatedCost: true,
      },
    })

    const monthlyBudget = 50000 // This could be configurable per employee/department
    const currentSpend = Number(monthlyTravelSpend._sum.estimatedCost) || 0
    const projectedSpend = currentSpend + validatedData.estimatedCost

    if (projectedSpend > monthlyBudget) {
      violations.push(`This request would exceed your monthly travel budget (₹${monthlyBudget.toLocaleString()})`)
    } else if (projectedSpend > monthlyBudget * 0.8) {
      warnings.push(`This request will use ${Math.round((projectedSpend / monthlyBudget) * 100)}% of your monthly travel budget`)
    }

    // Determine overall compliance status
    const isCompliant = violations.length === 0
    const requiresApproval = violations.length > 0 || warnings.length > 0 || validatedData.estimatedCost > 25000

    return NextResponse.json({
      isCompliant,
      requiresApproval,
      violations,
      warnings,
      recommendations,
      policyDetails: {
        employeeGrade,
        costLimits: limits,
        maxAdvancePercentage: 50,
        minAdvanceNoticeDays: minDays,
        monthlyBudget,
        currentMonthSpend: currentSpend,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error validating travel policy:', error)
    return NextResponse.json(
      { error: 'Failed to validate travel policy' },
      { status: 500 }
    )
  }
}

// GET /api/travel-requests/policy - Get travel policy information
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const employeeGrade = user.employee.salaryGrade || 'L1'

    const policyInfo = {
      costLimits: {
        'L1': { domestic: 25000, international: 75000 },
        'L2': { domestic: 35000, international: 100000 },
        'L3': { domestic: 50000, international: 125000 },
        'MANAGER': { domestic: 75000, international: 150000 },
        'SENIOR_MANAGER': { domestic: 100000, international: 200000 },
      },
      advancePolicy: {
        maxPercentage: 50,
        description: 'Advance amount cannot exceed 50% of estimated travel cost',
      },
      advanceNotice: {
        domestic: 3,
        international: 7,
        description: 'Minimum days of advance notice required',
      },
      approvalLevels: {
        'L1': 1,
        'L2': 1,
        'L3': 1,
        'MANAGER': 1,
        'SENIOR_MANAGER': 2,
      },
      monthlyBudget: 50000, // This could be configurable
      currentGrade: employeeGrade,
      applicableLimits: {
        ...({
          'L1': { domestic: 25000, international: 75000 },
          'L2': { domestic: 35000, international: 100000 },
          'L3': { domestic: 50000, international: 125000 },
          'MANAGER': { domestic: 75000, international: 150000 },
          'SENIOR_MANAGER': { domestic: 100000, international: 200000 },
        }[employeeGrade] || { domestic: 25000, international: 75000 }),
      },
    }

    return NextResponse.json(policyInfo)
  } catch (error) {
    console.error('Error fetching travel policy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch travel policy' },
      { status: 500 }
    )
  }
}
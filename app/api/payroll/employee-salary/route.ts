import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const assignSalaryStructureSchema = z.object({
  employeeId: z.string(),
  structureId: z.string(),
  ctc: z.number().positive('CTC must be positive'),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  revisionReason: z.string().optional(),
  componentOverrides: z.array(z.object({
    componentId: z.string(),
    value: z.number(),
  })).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const isActive = searchParams.get('active')

    const employeeSalaries = await prisma.employeeSalaryStructure.findMany({
      where: {
        ...(employeeId && { employeeId }),
        ...(isActive !== null && { isActive: isActive === 'true' }),
      },
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
        structure: {
          include: {
            grade: {
              select: {
                name: true,
                code: true,
              },
            },
            components: {
              include: {
                component: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    type: true,
                    category: true,
                    calculationType: true,
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        components: true,
      },
      orderBy: [
        { effectiveFrom: 'desc' },
      ],
    })

    return NextResponse.json(employeeSalaries)
  } catch (error) {
    console.error('Error fetching employee salaries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee salaries' },
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

    // Check if user has permission to assign salary structures
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = assignSalaryStructureSchema.parse(body)

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: validatedData.employeeId },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Validate salary structure exists
    const salaryStructure = await prisma.salaryStructure.findUnique({
      where: { id: validatedData.structureId },
      include: {
        components: {
          include: {
            component: true,
          },
        },
        grade: true,
      },
    })

    if (!salaryStructure || !salaryStructure.isActive) {
      return NextResponse.json({ error: 'Salary structure not found or inactive' }, { status: 404 })
    }

    // Validate CTC is within grade range if grade is specified
    if (salaryStructure.grade) {
      const ctc = validatedData.ctc
      if (ctc < salaryStructure.grade.minSalary.toNumber() || ctc > salaryStructure.grade.maxSalary.toNumber()) {
        return NextResponse.json(
          { 
            error: `CTC must be between ${salaryStructure.grade.minSalary} and ${salaryStructure.grade.maxSalary} for grade ${salaryStructure.grade.name}` 
          },
          { status: 400 }
        )
      }
    }

    // Check for overlapping active salary assignments
    const effectiveFrom = new Date(validatedData.effectiveFrom)
    const effectiveTo = validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : null

    const overlappingAssignment = await prisma.employeeSalaryStructure.findFirst({
      where: {
        employeeId: validatedData.employeeId,
        isActive: true,
        OR: [
          {
            AND: [
              { effectiveFrom: { lte: effectiveFrom } },
              { 
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: effectiveFrom } },
                ],
              },
            ],
          },
          ...(effectiveTo ? [{
            AND: [
              { effectiveFrom: { lte: effectiveTo } },
              { 
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: effectiveTo } },
                ],
              },
            ],
          }] : []),
        ],
      },
    })

    if (overlappingAssignment) {
      return NextResponse.json(
        { error: 'Employee already has an active salary assignment for this period' },
        { status: 400 }
      )
    }

    // Calculate component values based on CTC and structure
    const componentValues = await calculateComponentValues(
      salaryStructure,
      validatedData.ctc,
      validatedData.componentOverrides
    )

    // Create employee salary assignment in a transaction
    const employeeSalary = await prisma.$transaction(async (tx) => {
      const assignment = await tx.employeeSalaryStructure.create({
        data: {
          employeeId: validatedData.employeeId,
          structureId: validatedData.structureId,
          ctc: validatedData.ctc,
          effectiveFrom,
          effectiveTo,
          revisionReason: validatedData.revisionReason,
          approvedBy: session.user.id,
          approvedAt: new Date(),
        },
      })

      // Create component assignments
      await tx.employeeSalaryComponent.createMany({
        data: componentValues.map(cv => ({
          employeeSalaryId: assignment.id,
          componentId: cv.componentId,
          value: cv.value,
          isOverride: cv.isOverride,
        })),
      })

      return assignment
    })

    // Fetch the created assignment with all relations
    const result = await prisma.employeeSalaryStructure.findUnique({
      where: { id: employeeSalary.id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        structure: {
          include: {
            grade: true,
            components: {
              include: {
                component: true,
              },
            },
          },
        },
        components: true,
      },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error assigning salary structure:', error)
    return NextResponse.json(
      { error: 'Failed to assign salary structure' },
      { status: 500 }
    )
  }
}

// Helper function to calculate component values
async function calculateComponentValues(
  salaryStructure: any,
  ctc: number,
  overrides?: { componentId: string; value: number }[]
) {
  const componentValues = []
  let basicSalary = 0

  // First pass: calculate fixed components and find basic salary
  for (const structureComponent of salaryStructure.components) {
    const override = overrides?.find(o => o.componentId === structureComponent.componentId)
    
    if (override) {
      componentValues.push({
        componentId: structureComponent.componentId,
        value: override.value,
        isOverride: true,
      })
      
      if (structureComponent.component.category === 'BASIC') {
        basicSalary = override.value
      }
    } else if (structureComponent.component.calculationType === 'FIXED') {
      const value = structureComponent.value || 0
      componentValues.push({
        componentId: structureComponent.componentId,
        value,
        isOverride: false,
      })
      
      if (structureComponent.component.category === 'BASIC') {
        basicSalary = value
      }
    }
  }

  // If no basic salary found, calculate it as a percentage of CTC
  if (basicSalary === 0) {
    const basicComponent = salaryStructure.components.find(
      (c: any) => c.component.category === 'BASIC'
    )
    if (basicComponent && basicComponent.percentage) {
      basicSalary = (ctc * basicComponent.percentage) / 100
      componentValues.push({
        componentId: basicComponent.componentId,
        value: basicSalary,
        isOverride: false,
      })
    }
  }

  // Second pass: calculate percentage-based components
  for (const structureComponent of salaryStructure.components) {
    const alreadyCalculated = componentValues.find(cv => cv.componentId === structureComponent.componentId)
    if (alreadyCalculated) continue

    if (structureComponent.component.calculationType === 'PERCENTAGE') {
      let baseAmount = ctc
      
      if (structureComponent.baseComponent === 'BASIC') {
        baseAmount = basicSalary
      }
      
      const value = (baseAmount * (structureComponent.percentage || 0)) / 100
      
      // Apply min/max constraints
      let finalValue = value
      if (structureComponent.minValue && value < structureComponent.minValue) {
        finalValue = structureComponent.minValue
      }
      if (structureComponent.maxValue && value > structureComponent.maxValue) {
        finalValue = structureComponent.maxValue
      }
      
      componentValues.push({
        componentId: structureComponent.componentId,
        value: finalValue,
        isOverride: false,
      })
    }
  }

  return componentValues
}
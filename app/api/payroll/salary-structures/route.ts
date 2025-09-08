import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const componentSchema = z.object({
  componentId: z.string(),
  value: z.number().optional(),
  percentage: z.number().optional(),
  baseComponent: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  isVariable: z.boolean().default(false),
  order: z.number().default(0),
})

const createSalaryStructureSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  gradeId: z.string().optional(),
  description: z.string().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  components: z.array(componentSchema),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const gradeId = searchParams.get('gradeId')
    const isActive = searchParams.get('active')

    const salaryStructures = await prisma.salaryStructure.findMany({
      where: {
        ...(gradeId && { gradeId }),
        ...(isActive !== null && { isActive: isActive === 'true' }),
      },
      include: {
        grade: {
          select: {
            id: true,
            name: true,
            code: true,
            minSalary: true,
            maxSalary: true,
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
                isStatutory: true,
                isTaxable: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            employeeSalaries: true,
          },
        },
      },
      orderBy: [
        { name: 'asc' },
      ],
    })

    return NextResponse.json(salaryStructures)
  } catch (error) {
    console.error('Error fetching salary structures:', error)
    return NextResponse.json(
      { error: 'Failed to fetch salary structures' },
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

    // Check if user has permission to create salary structures
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createSalaryStructureSchema.parse(body)

    // Check for duplicate name or code
    const existingStructure = await prisma.salaryStructure.findFirst({
      where: {
        OR: [
          { name: validatedData.name },
          { code: validatedData.code },
        ],
      },
    })

    if (existingStructure) {
      return NextResponse.json(
        { error: 'Salary structure with this name or code already exists' },
        { status: 400 }
      )
    }

    // Validate that all component IDs exist
    const componentIds = validatedData.components.map(c => c.componentId)
    const existingComponents = await prisma.payComponent.findMany({
      where: {
        id: { in: componentIds },
        isActive: true,
      },
    })

    if (existingComponents.length !== componentIds.length) {
      return NextResponse.json(
        { error: 'One or more pay components not found or inactive' },
        { status: 400 }
      )
    }

    // Validate component configurations
    for (const component of validatedData.components) {
      const payComponent = existingComponents.find(c => c.id === component.componentId)
      
      if (payComponent?.calculationType === 'FIXED' && !component.value) {
        return NextResponse.json(
          { error: `Fixed component ${payComponent.name} must have a value` },
          { status: 400 }
        )
      }
      
      if (payComponent?.calculationType === 'PERCENTAGE' && !component.percentage) {
        return NextResponse.json(
          { error: `Percentage component ${payComponent.name} must have a percentage` },
          { status: 400 }
        )
      }
    }

    // Create salary structure with components in a transaction
    const salaryStructure = await prisma.$transaction(async (tx) => {
      const structure = await tx.salaryStructure.create({
        data: {
          name: validatedData.name,
          code: validatedData.code,
          gradeId: validatedData.gradeId,
          description: validatedData.description,
          effectiveFrom: validatedData.effectiveFrom ? new Date(validatedData.effectiveFrom) : new Date(),
          effectiveTo: validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : undefined,
        },
      })

      // Create structure components
      await tx.salaryStructureComponent.createMany({
        data: validatedData.components.map(component => ({
          structureId: structure.id,
          componentId: component.componentId,
          value: component.value,
          percentage: component.percentage,
          baseComponent: component.baseComponent,
          minValue: component.minValue,
          maxValue: component.maxValue,
          isVariable: component.isVariable,
          order: component.order,
        })),
      })

      return structure
    })

    // Fetch the created structure with all relations
    const createdStructure = await prisma.salaryStructure.findUnique({
      where: { id: salaryStructure.id },
      include: {
        grade: true,
        components: {
          include: {
            component: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    return NextResponse.json(createdStructure, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating salary structure:', error)
    return NextResponse.json(
      { error: 'Failed to create salary structure' },
      { status: 500 }
    )
  }
}
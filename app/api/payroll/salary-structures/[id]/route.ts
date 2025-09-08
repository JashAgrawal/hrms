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

const updateSalaryStructureSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  code: z.string().min(1, 'Code is required').optional(),
  gradeId: z.string().optional(),
  description: z.string().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  components: z.array(componentSchema).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const salaryStructure = await prisma.salaryStructure.findUnique({
      where: { id },
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
        employeeSalaries: {
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
          },
          where: {
            isActive: true,
          },
        },
        _count: {
          select: {
            employeeSalaries: true,
          },
        },
      },
    })

    if (!salaryStructure) {
      return NextResponse.json({ error: 'Salary structure not found' }, { status: 404 })
    }

    return NextResponse.json(salaryStructure)
  } catch (error) {
    console.error('Error fetching salary structure:', error)
    return NextResponse.json(
      { error: 'Failed to fetch salary structure' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update salary structures
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateSalaryStructureSchema.parse(body)

    // Check if salary structure exists
    const existingStructure = await prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employeeSalaries: true,
          },
        },
      },
    })

    if (!existingStructure) {
      return NextResponse.json({ error: 'Salary structure not found' }, { status: 404 })
    }

    // Check for duplicate name or code (excluding current record)
    if (validatedData.name || validatedData.code) {
      const duplicateStructure = await prisma.salaryStructure.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(validatedData.name ? [{ name: validatedData.name }] : []),
                ...(validatedData.code ? [{ code: validatedData.code }] : []),
              ],
            },
          ],
        },
      })

      if (duplicateStructure) {
        return NextResponse.json(
          { error: 'Salary structure with this name or code already exists' },
          { status: 400 }
        )
      }
    }

    // If components are being updated, validate them
    if (validatedData.components) {
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
    }

    // Update salary structure with components in a transaction
    const updatedStructure = await prisma.$transaction(async (tx) => {
      const structure = await tx.salaryStructure.update({
        where: { id },
        data: {
          ...(validatedData.name && { name: validatedData.name }),
          ...(validatedData.code && { code: validatedData.code }),
          ...(validatedData.gradeId !== undefined && { gradeId: validatedData.gradeId }),
          ...(validatedData.description !== undefined && { description: validatedData.description }),
          ...(validatedData.effectiveFrom && { effectiveFrom: new Date(validatedData.effectiveFrom) }),
          ...(validatedData.effectiveTo !== undefined && { 
            effectiveTo: validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : null 
          }),
          ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
        },
      })

      // Update components if provided
      if (validatedData.components) {
        // Delete existing components
        await tx.salaryStructureComponent.deleteMany({
          where: { structureId: id },
        })

        // Create new components
        await tx.salaryStructureComponent.createMany({
          data: validatedData.components.map(component => ({
            structureId: id,
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
      }

      return structure
    })

    // Fetch the updated structure with all relations
    const result = await prisma.salaryStructure.findUnique({
      where: { id },
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

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating salary structure:', error)
    return NextResponse.json(
      { error: 'Failed to update salary structure' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete salary structures
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if salary structure exists
    const existingStructure = await prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employeeSalaries: true,
          },
        },
      },
    })

    if (!existingStructure) {
      return NextResponse.json({ error: 'Salary structure not found' }, { status: 404 })
    }

    // Check if salary structure is being used
    if (existingStructure._count.employeeSalaries > 0) {
      return NextResponse.json(
        { error: 'Cannot delete salary structure that is assigned to employees' },
        { status: 400 }
      )
    }

    // Delete salary structure and its components in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.salaryStructureComponent.deleteMany({
        where: { structureId: id },
      })

      await tx.salaryStructure.delete({
        where: { id },
      })
    })

    return NextResponse.json({ message: 'Salary structure deleted successfully' })
  } catch (error) {
    console.error('Error deleting salary structure:', error)
    return NextResponse.json(
      { error: 'Failed to delete salary structure' },
      { status: 500 }
    )
  }
}
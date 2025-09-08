import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const approveSalaryRevisionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to approve salary revisions
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { action, comments } = approveSalaryRevisionSchema.parse(body)

    // Get the salary revision
    const salaryRevision = await prisma.salaryRevision.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            salaryStructures: {
              where: {
                isActive: true,
                effectiveFrom: { lte: new Date() },
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: new Date() } },
                ],
              },
              include: {
                structure: {
                  include: {
                    components: {
                      include: {
                        component: true,
                      },
                    },
                  },
                },
                components: true,
              },
              orderBy: {
                effectiveFrom: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    })

    if (!salaryRevision) {
      return NextResponse.json({ error: 'Salary revision not found' }, { status: 404 })
    }

    if (salaryRevision.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Salary revision is not in pending status' },
        { status: 400 }
      )
    }

    if (action === 'reject') {
      // Simply update the revision status to rejected
      const updatedRevision = await prisma.salaryRevision.update({
        where: { id },
        data: {
          status: 'REJECTED',
          approvedBy: session.user.id,
          approvedAt: new Date(),
        },
      })

      return NextResponse.json({
        message: 'Salary revision rejected successfully',
        revision: updatedRevision,
      })
    }

    // Approve the revision and implement it
    const result = await prisma.$transaction(async (tx) => {
      // Update revision status
      const updatedRevision = await tx.salaryRevision.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: session.user.id,
          approvedAt: new Date(),
        },
      })

      // Get current salary structure
      const currentSalaryStructure = salaryRevision.employee.salaryStructures[0]
      
      if (!currentSalaryStructure) {
        throw new Error('Employee does not have an active salary structure')
      }

      // End the current salary assignment
      await tx.employeeSalaryStructure.update({
        where: { id: currentSalaryStructure.id },
        data: {
          effectiveTo: new Date(salaryRevision.effectiveFrom.getTime() - 24 * 60 * 60 * 1000), // Day before new effective date
        },
      })

      // Calculate new component values based on the new CTC
      const newComponentValues = await calculateRevisedComponentValues(
        currentSalaryStructure,
        salaryRevision.newCTC.toNumber()
      )

      // Create new salary assignment
      const newSalaryAssignment = await tx.employeeSalaryStructure.create({
        data: {
          employeeId: salaryRevision.employeeId,
          structureId: currentSalaryStructure.structureId,
          ctc: salaryRevision.newCTC,
          effectiveFrom: salaryRevision.effectiveFrom,
          revisionReason: `${salaryRevision.revisionType}: ${salaryRevision.reason || 'Salary revision'}`,
          approvedBy: session.user.id,
          approvedAt: new Date(),
        },
      })

      // Create new component assignments
      await tx.employeeSalaryComponent.createMany({
        data: newComponentValues.map(cv => ({
          employeeSalaryId: newSalaryAssignment.id,
          componentId: cv.componentId,
          value: cv.value,
          isOverride: cv.isOverride,
        })),
      })

      // Update revision status to implemented
      await tx.salaryRevision.update({
        where: { id },
        data: {
          status: 'IMPLEMENTED',
        },
      })

      return {
        revision: updatedRevision,
        newSalaryAssignment,
      }
    })

    return NextResponse.json({
      message: 'Salary revision approved and implemented successfully',
      ...result,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing salary revision:', error)
    return NextResponse.json(
      { error: 'Failed to process salary revision' },
      { status: 500 }
    )
  }
}

// Helper function to calculate revised component values
async function calculateRevisedComponentValues(
  currentSalaryStructure: any,
  newCTC: number
) {
  const componentValues = []
  let basicSalary = 0

  // Calculate new component values based on the structure
  for (const component of currentSalaryStructure.components) {
    const structureComponent = currentSalaryStructure.structure.components.find(
      (sc: any) => sc.componentId === component.componentId
    )

    if (!structureComponent) continue

    let newValue = component.value

    if (structureComponent.component.calculationType === 'PERCENTAGE') {
      let baseAmount = newCTC
      
      if (structureComponent.baseComponent === 'BASIC') {
        // We'll calculate basic salary first
        const basicComponent = currentSalaryStructure.structure.components.find(
          (sc: any) => sc.component.category === 'BASIC'
        )
        if (basicComponent && basicComponent.percentage) {
          baseAmount = (newCTC * basicComponent.percentage) / 100
        }
      }
      
      newValue = (baseAmount * (structureComponent.percentage || 0)) / 100
      
      // Apply min/max constraints
      if (structureComponent.minValue && newValue < structureComponent.minValue) {
        newValue = structureComponent.minValue
      }
      if (structureComponent.maxValue && newValue > structureComponent.maxValue) {
        newValue = structureComponent.maxValue
      }
    } else if (structureComponent.component.calculationType === 'FIXED') {
      // Keep the same fixed value unless it's basic salary
      if (structureComponent.component.category === 'BASIC' && structureComponent.percentage) {
        newValue = (newCTC * structureComponent.percentage) / 100
      }
    }

    if (structureComponent.component.category === 'BASIC') {
      basicSalary = newValue
    }

    componentValues.push({
      componentId: component.componentId,
      value: newValue,
      isOverride: component.isOverride,
    })
  }

  return componentValues
}
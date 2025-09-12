import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateAssignmentSchema = z.object({
  ctc: z.number().min(1, 'CTC must be greater than 0').optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  revisionReason: z.string().optional(),
  approvedBy: z.string().optional(),
  componentOverrides: z.array(z.object({
    componentId: z.string(),
    value: z.number(),
  })).optional(),
})

const revokeAssignmentSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  effectiveDate: z.string().datetime().optional(),
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

    const assignment = await prisma.employeeSalaryStructure.findUnique({
      where: { id },
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
                id: true,
                name: true,
              },
            },
          },
        },
        structure: {
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
        },
        components: true,
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Check if user can view this assignment
    if (session.user.role === 'EMPLOYEE' && assignment.employeeId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error fetching salary assignment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch salary assignment' },
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

    // Check permissions
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateAssignmentSchema.parse(body)

    // Check if assignment exists
    const existingAssignment = await prisma.employeeSalaryStructure.findUnique({
      where: { id },
      include: {
        structure: {
          include: {
            grade: true,
          },
        },
      },
    })

    if (!existingAssignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Validate CTC against grade limits if provided
    if (validatedData.ctc && existingAssignment.structure.grade) {
      const grade = existingAssignment.structure.grade
      if (validatedData.ctc < Number(grade.minSalary) || validatedData.ctc > Number(grade.maxSalary)) {
        return NextResponse.json(
          { 
            error: `CTC must be between ₹${grade.minSalary.toLocaleString()} and ₹${grade.maxSalary.toLocaleString()}` 
          },
          { status: 400 }
        )
      }
    }

    const updatedAssignment = await prisma.$transaction(async (tx) => {
      // Update the assignment
      const assignment = await tx.employeeSalaryStructure.update({
        where: { id },
        data: {
          ctc: validatedData.ctc,
          effectiveFrom: validatedData.effectiveFrom ? new Date(validatedData.effectiveFrom) : undefined,
          effectiveTo: validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : undefined,
          revisionReason: validatedData.revisionReason,
          approvedBy: validatedData.approvedBy || session.user.id,
          approvedAt: new Date(),
        },
      })

      // Update component overrides if provided
      if (validatedData.componentOverrides) {
        // Delete existing overrides
        await tx.employeeSalaryComponent.deleteMany({
          where: { employeeSalaryId: id },
        })

        // Create new overrides
        if (validatedData.componentOverrides.length > 0) {
          await tx.employeeSalaryComponent.createMany({
            data: validatedData.componentOverrides.map(override => ({
              employeeSalaryId: id,
              componentId: override.componentId,
              value: override.value,
              isOverride: true,
            })),
          })
        }
      }

      return assignment
    })

    // Fetch updated assignment with relations
    const result = await prisma.employeeSalaryStructure.findUnique({
      where: { id },
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
                id: true,
                name: true,
              },
            },
          },
        },
        structure: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
          },
        },
        components: true,
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

    console.error('Error updating salary assignment:', error)
    return NextResponse.json(
      { error: 'Failed to update salary assignment' },
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

    // Check permissions
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = revokeAssignmentSchema.parse(body)

    // Check if assignment exists
    const existingAssignment = await prisma.employeeSalaryStructure.findUnique({
      where: { id },
    })

    if (!existingAssignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Instead of deleting, mark as inactive with end date
    const effectiveDate = validatedData.effectiveDate ? new Date(validatedData.effectiveDate) : new Date()

    const revokedAssignment = await prisma.employeeSalaryStructure.update({
      where: { id },
      data: {
        effectiveTo: effectiveDate,
        isActive: false,
        revisionReason: `REVOKED: ${validatedData.reason}`,
      },
    })

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REVOKE_SALARY_ASSIGNMENT',
        resource: 'EMPLOYEE_SALARY_STRUCTURE',
        resourceId: id,
        details: {
          reason: validatedData.reason,
          effectiveDate: effectiveDate.toISOString(),
          employeeId: existingAssignment.employeeId,
          structureId: existingAssignment.structureId,
        },
      },
    })

    return NextResponse.json({ 
      message: 'Salary assignment revoked successfully',
      assignment: revokedAssignment,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error revoking salary assignment:', error)
    return NextResponse.json(
      { error: 'Failed to revoke salary assignment' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { salaryStructureService } from '@/lib/salary-structure-service'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const assignSalarySchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  structureId: z.string().min(1, 'Structure ID is required'),
  ctc: z.number().min(1, 'CTC must be greater than 0'),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  revisionReason: z.string().optional(),
  approvedBy: z.string().optional(),
  componentOverrides: z.array(z.object({
    componentId: z.string(),
    value: z.number(),
  })).optional(),
})

const bulkAssignSchema = z.object({
  assignments: z.array(assignSalarySchema),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const structureId = searchParams.get('structureId')
    const isActive = searchParams.get('active')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: any = {}
    
    if (employeeId) {
      where.employeeId = employeeId
    }
    
    if (structureId) {
      where.structureId = structureId
    }
    
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const [assignments, total] = await Promise.all([
      prisma.employeeSalaryStructure.findMany({
        where,
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
              grade: {
                select: {
                  id: true,
                  name: true,
                  minSalary: true,
                  maxSalary: true,
                },
              },
            },
          },
          components: true,
        },
        orderBy: [
          { isActive: 'desc' },
          { effectiveFrom: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.employeeSalaryStructure.count({ where }),
    ])

    return NextResponse.json({
      assignments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching salary assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch salary assignments' },
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

    // Check permissions
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    
    // Check if it's a bulk assignment
    if (body.assignments && Array.isArray(body.assignments)) {
      const validatedData = bulkAssignSchema.parse(body)
      const results = []
      const errors = []

      for (const assignment of validatedData.assignments) {
        try {
          const result = await salaryStructureService.assignStructureToEmployee({
            employeeId: assignment.employeeId,
            structureId: assignment.structureId,
            ctc: assignment.ctc,
            effectiveFrom: new Date(assignment.effectiveFrom),
            effectiveTo: assignment.effectiveTo ? new Date(assignment.effectiveTo) : undefined,
            revisionReason: assignment.revisionReason,
            approvedBy: assignment.approvedBy || session.user.id,
            componentOverrides: assignment.componentOverrides,
          })
          results.push(result)
        } catch (error) {
          errors.push({
            employeeId: assignment.employeeId,
            error: error instanceof Error ? error.message : 'Assignment failed',
          })
        }
      }

      return NextResponse.json({
        success: results.length,
        failed: errors.length,
        results,
        errors,
      }, { status: 201 })
    } else {
      // Single assignment
      const validatedData = assignSalarySchema.parse(body)

      const assignment = await salaryStructureService.assignStructureToEmployee({
        employeeId: validatedData.employeeId,
        structureId: validatedData.structureId,
        ctc: validatedData.ctc,
        effectiveFrom: new Date(validatedData.effectiveFrom),
        effectiveTo: validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : undefined,
        revisionReason: validatedData.revisionReason,
        approvedBy: validatedData.approvedBy || session.user.id,
        componentOverrides: validatedData.componentOverrides,
      })

      // Fetch the created assignment with relations
      const createdAssignment = await prisma.employeeSalaryStructure.findUnique({
        where: { id: assignment.id },
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

      return NextResponse.json(createdAssignment, { status: 201 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating salary assignment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create salary assignment' },
      { status: 500 }
    )
  }
}
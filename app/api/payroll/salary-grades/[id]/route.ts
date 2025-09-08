import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSalaryGradeSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  code: z.string().min(1, 'Code is required').optional(),
  description: z.string().optional(),
  minSalary: z.number().positive('Minimum salary must be positive').optional(),
  maxSalary: z.number().positive('Maximum salary must be positive').optional(),
  currency: z.string().optional(),
  isActive: z.boolean().optional(),
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

    const salaryGrade = await prisma.salaryGrade.findUnique({
      where: { id },
      include: {
        salaryStructures: {
          include: {
            _count: {
              select: {
                employeeSalaries: true,
              },
            },
          },
        },
        _count: {
          select: {
            salaryStructures: true,
          },
        },
      },
    })

    if (!salaryGrade) {
      return NextResponse.json({ error: 'Salary grade not found' }, { status: 404 })
    }

    return NextResponse.json(salaryGrade)
  } catch (error) {
    console.error('Error fetching salary grade:', error)
    return NextResponse.json(
      { error: 'Failed to fetch salary grade' },
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

    // Check if user has permission to update salary grades
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateSalaryGradeSchema.parse(body)

    // Check if salary grade exists
    const existingGrade = await prisma.salaryGrade.findUnique({
      where: { id },
    })

    if (!existingGrade) {
      return NextResponse.json({ error: 'Salary grade not found' }, { status: 404 })
    }

    // Validate salary range if both values are provided
    const minSalary = validatedData.minSalary ?? existingGrade.minSalary
    const maxSalary = validatedData.maxSalary ?? existingGrade.maxSalary

    if (maxSalary <= minSalary) {
      return NextResponse.json(
        { error: 'Maximum salary must be greater than minimum salary' },
        { status: 400 }
      )
    }

    // Check for duplicate name or code (excluding current record)
    if (validatedData.name || validatedData.code) {
      const duplicateGrade = await prisma.salaryGrade.findFirst({
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

      if (duplicateGrade) {
        return NextResponse.json(
          { error: 'Salary grade with this name or code already exists' },
          { status: 400 }
        )
      }
    }

    const updatedGrade = await prisma.salaryGrade.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(updatedGrade)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating salary grade:', error)
    return NextResponse.json(
      { error: 'Failed to update salary grade' },
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

    // Check if user has permission to delete salary grades
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if salary grade exists
    const existingGrade = await prisma.salaryGrade.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            salaryStructures: true,
          },
        },
      },
    })

    if (!existingGrade) {
      return NextResponse.json({ error: 'Salary grade not found' }, { status: 404 })
    }

    // Check if salary grade is being used
    if (existingGrade._count.salaryStructures > 0) {
      return NextResponse.json(
        { error: 'Cannot delete salary grade that is being used by salary structures' },
        { status: 400 }
      )
    }

    await prisma.salaryGrade.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Salary grade deleted successfully' })
  } catch (error) {
    console.error('Error deleting salary grade:', error)
    return NextResponse.json(
      { error: 'Failed to delete salary grade' },
      { status: 500 }
    )
  }
}
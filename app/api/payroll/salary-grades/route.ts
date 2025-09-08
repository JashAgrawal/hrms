import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSalaryGradeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  minSalary: z.number().positive('Minimum salary must be positive'),
  maxSalary: z.number().positive('Maximum salary must be positive'),
  currency: z.string().default('INR'),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('active')

    const salaryGrades = await prisma.salaryGrade.findMany({
      where: {
        ...(isActive !== null && { isActive: isActive === 'true' }),
      },
      include: {
        _count: {
          select: {
            salaryStructures: true,
          },
        },
      },
      orderBy: [
        { minSalary: 'asc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json(salaryGrades)
  } catch (error) {
    console.error('Error fetching salary grades:', error)
    return NextResponse.json(
      { error: 'Failed to fetch salary grades' },
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

    // Check if user has permission to create salary grades
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createSalaryGradeSchema.parse(body)

    // Validate that maxSalary is greater than minSalary
    if (validatedData.maxSalary <= validatedData.minSalary) {
      return NextResponse.json(
        { error: 'Maximum salary must be greater than minimum salary' },
        { status: 400 }
      )
    }

    // Check for duplicate name or code
    const existingGrade = await prisma.salaryGrade.findFirst({
      where: {
        OR: [
          { name: validatedData.name },
          { code: validatedData.code },
        ],
      },
    })

    if (existingGrade) {
      return NextResponse.json(
        { error: 'Salary grade with this name or code already exists' },
        { status: 400 }
      )
    }

    const salaryGrade = await prisma.salaryGrade.create({
      data: validatedData,
    })

    return NextResponse.json(salaryGrade, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating salary grade:', error)
    return NextResponse.json(
      { error: 'Failed to create salary grade' },
      { status: 500 }
    )
  }
}
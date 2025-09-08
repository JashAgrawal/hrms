import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { PayComponentType, PayComponentCategory, CalculationType } from '@prisma/client'

const createPayComponentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  type: z.nativeEnum(PayComponentType),
  category: z.nativeEnum(PayComponentCategory),
  calculationType: z.nativeEnum(CalculationType),
  isStatutory: z.boolean().default(false),
  isTaxable: z.boolean().default(true),
  description: z.string().optional(),
  formula: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as PayComponentType | null
    const category = searchParams.get('category') as PayComponentCategory | null
    const isActive = searchParams.get('active')
    const isStatutory = searchParams.get('statutory')

    const payComponents = await prisma.payComponent.findMany({
      where: {
        ...(type && { type }),
        ...(category && { category }),
        ...(isActive !== null && { isActive: isActive === 'true' }),
        ...(isStatutory !== null && { isStatutory: isStatutory === 'true' }),
      },
      include: {
        _count: {
          select: {
            structureComponents: true,
          },
        },
      },
      orderBy: [
        { type: 'asc' },
        { category: 'asc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json(payComponents)
  } catch (error) {
    console.error('Error fetching pay components:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay components' },
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

    // Check if user has permission to create pay components
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createPayComponentSchema.parse(body)

    // Check for duplicate name or code
    const existingComponent = await prisma.payComponent.findFirst({
      where: {
        OR: [
          { name: validatedData.name },
          { code: validatedData.code },
        ],
      },
    })

    if (existingComponent) {
      return NextResponse.json(
        { error: 'Pay component with this name or code already exists' },
        { status: 400 }
      )
    }

    const payComponent = await prisma.payComponent.create({
      data: validatedData,
    })

    return NextResponse.json(payComponent, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating pay component:', error)
    return NextResponse.json(
      { error: 'Failed to create pay component' },
      { status: 500 }
    )
  }
}
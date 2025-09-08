import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { PayComponentType, PayComponentCategory, CalculationType } from '@prisma/client'

const updatePayComponentSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  code: z.string().min(1, 'Code is required').optional(),
  type: z.nativeEnum(PayComponentType).optional(),
  category: z.nativeEnum(PayComponentCategory).optional(),
  calculationType: z.nativeEnum(CalculationType).optional(),
  isStatutory: z.boolean().optional(),
  isTaxable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
  formula: z.string().optional(),
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

    const payComponent = await prisma.payComponent.findUnique({
      where: { id },
      include: {
        structureComponents: {
          include: {
            structure: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        _count: {
          select: {
            structureComponents: true,
          },
        },
      },
    })

    if (!payComponent) {
      return NextResponse.json({ error: 'Pay component not found' }, { status: 404 })
    }

    return NextResponse.json(payComponent)
  } catch (error) {
    console.error('Error fetching pay component:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay component' },
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

    // Check if user has permission to update pay components
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updatePayComponentSchema.parse(body)

    // Check if pay component exists
    const existingComponent = await prisma.payComponent.findUnique({
      where: { id },
    })

    if (!existingComponent) {
      return NextResponse.json({ error: 'Pay component not found' }, { status: 404 })
    }

    // Check for duplicate name or code (excluding current record)
    if (validatedData.name || validatedData.code) {
      const duplicateComponent = await prisma.payComponent.findFirst({
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

      if (duplicateComponent) {
        return NextResponse.json(
          { error: 'Pay component with this name or code already exists' },
          { status: 400 }
        )
      }
    }

    const updatedComponent = await prisma.payComponent.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(updatedComponent)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating pay component:', error)
    return NextResponse.json(
      { error: 'Failed to update pay component' },
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

    // Check if user has permission to delete pay components
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if pay component exists
    const existingComponent = await prisma.payComponent.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            structureComponents: true,
          },
        },
      },
    })

    if (!existingComponent) {
      return NextResponse.json({ error: 'Pay component not found' }, { status: 404 })
    }

    // Check if pay component is being used
    if (existingComponent._count.structureComponents > 0) {
      return NextResponse.json(
        { error: 'Cannot delete pay component that is being used in salary structures' },
        { status: 400 }
      )
    }

    await prisma.payComponent.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Pay component deleted successfully' })
  } catch (error) {
    console.error('Error deleting pay component:', error)
    return NextResponse.json(
      { error: 'Failed to delete pay component' },
      { status: 500 }
    )
  }
}
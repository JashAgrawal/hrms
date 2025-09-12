import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { salaryStructureService } from '@/lib/salary-structure-service'
import { z } from 'zod'

const createVersionSchema = z.object({
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  changeLog: z.string().optional(),
  components: z.array(z.object({
    componentId: z.string(),
    value: z.number().optional(),
    percentage: z.number().optional(),
    baseComponent: z.string().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    isVariable: z.boolean().optional(),
    order: z.number(),
  })).optional(),
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

    // Get structure name first
    const structure = await prisma.salaryStructure.findUnique({
      where: { id },
      select: { name: true },
    })

    if (!structure) {
      return NextResponse.json({ error: 'Structure not found' }, { status: 404 })
    }

    const versions = await salaryStructureService.getStructureVersions(structure.name)
    return NextResponse.json(versions)
  } catch (error) {
    console.error('Error fetching structure versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch structure versions' },
      { status: 500 }
    )
  }
}

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

    // Check permissions
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createVersionSchema.parse(body)

    const newVersion = await salaryStructureService.createStructureVersion(id, {
      effectiveFrom: new Date(validatedData.effectiveFrom),
      effectiveTo: validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : undefined,
      changeLog: validatedData.changeLog,
      components: validatedData.components,
    })

    return NextResponse.json(newVersion, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating structure version:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create structure version' },
      { status: 500 }
    )
  }
}
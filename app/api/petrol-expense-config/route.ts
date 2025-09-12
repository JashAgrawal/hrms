import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const createPetrolConfigSchema = z.object({
  ratePerKm: z.number().positive('Rate per km must be positive'),
  currency: z.string().default('INR'),
  effectiveFrom: z.string().transform((str) => new Date(str)).optional(),
})

// GET /api/petrol-expense-config - Get current petrol expense configuration
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current active configuration
    const currentConfig = await prisma.petrolExpenseConfig.findFirst({
      where: {
        isActive: true,
        effectiveFrom: {
          lte: new Date(),
        },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    })

    if (!currentConfig) {
      return NextResponse.json(
        { error: 'No active petrol expense configuration found' },
        { status: 404 }
      )
    }

    return NextResponse.json(currentConfig)
  } catch (error) {
    console.error('Error fetching petrol expense config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch petrol expense configuration' },
      { status: 500 }
    )
  }
}

// POST /api/petrol-expense-config - Create new petrol expense configuration
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create petrol config (admin/finance)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['ADMIN', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createPetrolConfigSchema.parse(body)

    // Deactivate current configuration
    await prisma.petrolExpenseConfig.updateMany({
      where: { isActive: true },
      data: {
        isActive: false,
        effectiveTo: validatedData.effectiveFrom || new Date(),
      },
    })

    // Create new configuration
    const config = await prisma.petrolExpenseConfig.create({
      data: {
        ...validatedData,
        effectiveFrom: validatedData.effectiveFrom || new Date(),
        createdBy: session.user.id,
      },
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating petrol expense config:', error)
    return NextResponse.json(
      { error: 'Failed to create petrol expense configuration' },
      { status: 500 }
    )
  }
}

// GET /api/petrol-expense-config/history - Get configuration history
export async function GET_HISTORY(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to view config history
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['ADMIN', 'FINANCE', 'HR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const configs = await prisma.petrolExpenseConfig.findMany({
      orderBy: { effectiveFrom: 'desc' },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('Error fetching petrol expense config history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configuration history' },
      { status: 500 }
    )
  }
}
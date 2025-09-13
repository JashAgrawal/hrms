import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for petrol expense configuration
const petrolConfigSchema = z.object({
  ratePerKm: z.number().positive('Rate per km must be positive'),
  effectiveFrom: z.string().transform((str) => new Date(str)).optional(),
  effectiveTo: z.string().transform((str) => new Date(str)).optional()
})

// GET /api/expenses/petrol-config - Get current petrol expense configuration
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current active configuration
    const currentConfig = await prisma.petrolExpenseConfig.findFirst({
      where: {
        isActive: true,
        effectiveFrom: {
          lte: new Date()
        },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } }
        ]
      },
      orderBy: { effectiveFrom: 'desc' }
    })

    if (!currentConfig) {
      return NextResponse.json(
        { error: 'No active petrol expense configuration found' },
        { status: 404 }
      )
    }

    return NextResponse.json(currentConfig)
  } catch (error) {
    console.error('Error fetching petrol expense configuration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/expenses/petrol-config - Create new petrol expense configuration (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = petrolConfigSchema.parse(body)

    // Deactivate current active configuration
    await prisma.petrolExpenseConfig.updateMany({
      where: { isActive: true },
      data: { 
        isActive: false,
        effectiveTo: validatedData.effectiveFrom || new Date()
      }
    })

    // Create new configuration
    const newConfig = await prisma.petrolExpenseConfig.create({
      data: {
        ratePerKm: validatedData.ratePerKm,
        effectiveFrom: validatedData.effectiveFrom || new Date(),
        effectiveTo: validatedData.effectiveTo,
        createdBy: session.user.id
      }
    })

    return NextResponse.json(newConfig, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating petrol expense configuration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const retentionPolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().optional(),
  category: z.enum(['PERSONAL', 'PROFESSIONAL', 'COMPLIANCE', 'PAYROLL', 'PERFORMANCE', 'LEAVE', 'EXPENSE', 'TRAINING', 'LEGAL', 'MEDICAL', 'INSURANCE', 'TAX', 'BANK', 'OTHER']).optional(),
  retentionPeriod: z.number().min(1, 'Retention period must be at least 1 day'),
  action: z.enum(['ARCHIVE', 'DELETE', 'REVIEW'])
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin/HR can view retention policies
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const policies = await prisma.documentRetentionPolicy.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ policies })
  } catch (error) {
    console.error('Error fetching retention policies:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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

    // Only admin/HR can create retention policies
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = retentionPolicySchema.parse(body)

    // Check if policy name already exists
    const existingPolicy = await prisma.documentRetentionPolicy.findUnique({
      where: { name: validatedData.name }
    })

    if (existingPolicy) {
      return NextResponse.json(
        { error: 'Policy name already exists' },
        { status: 400 }
      )
    }

    const policy = await prisma.documentRetentionPolicy.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category || null,
        retentionPeriod: validatedData.retentionPeriod,
        action: validatedData.action
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        resource: 'DOCUMENT_RETENTION_POLICY',
        resourceId: policy.id,
        newValues: {
          name: policy.name,
          retentionPeriod: policy.retentionPeriod,
          action: policy.action
        }
      }
    })

    return NextResponse.json({ policy }, { status: 201 })
  } catch (error) {
    console.error('Error creating retention policy:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
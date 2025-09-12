import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const documentTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  category: z.enum(['PERSONAL', 'PROFESSIONAL', 'COMPLIANCE', 'PAYROLL', 'PERFORMANCE', 'TRAINING', 'LEGAL', 'MEDICAL', 'INSURANCE', 'TAX', 'BANK', 'OTHER']),
  isRequired: z.boolean().default(false),
  validityPeriod: z.number().optional(),
  approvalLevels: z.number().min(1).max(5).default(1),
  approvers: z.array(z.string()).optional(),
  reminderDays: z.array(z.number()).optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await prisma.documentTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching document templates:', error)
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

    // Only admin/HR can create document templates
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = documentTemplateSchema.parse(body)

    // Check if template name already exists
    const existingTemplate = await prisma.documentTemplate.findUnique({
      where: { name: validatedData.name }
    })

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'Template name already exists' },
        { status: 400 }
      )
    }

    const template = await prisma.documentTemplate.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        isRequired: validatedData.isRequired,
        validityPeriod: validatedData.validityPeriod,
        approvalLevels: validatedData.approvalLevels,
        approvers: validatedData.approvers ? JSON.stringify(validatedData.approvers) : Prisma.JsonNull,
        reminderDays: validatedData.reminderDays ? JSON.stringify(validatedData.reminderDays) : Prisma.JsonNull
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        resource: 'DOCUMENT_TEMPLATE',
        resourceId: template.id,
        newValues: {
          name: template.name,
          category: template.category,
          isRequired: template.isRequired
        }
      }
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Error creating document template:', error)
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
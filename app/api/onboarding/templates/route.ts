import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  tasks: z.array(z.object({
    title: z.string().min(1, 'Task title is required'),
    description: z.string().optional(),
    category: z.enum(['PERSONAL_INFO', 'DOCUMENTS', 'SYSTEM_ACCESS', 'TRAINING', 'COMPLIANCE', 'EQUIPMENT', 'INTRODUCTION']),
    isRequired: z.boolean().default(true),
    order: z.number().int().positive(),
    daysToComplete: z.number().int().positive().optional(),
    assignedRole: z.enum(['ADMIN', 'HR', 'MANAGER', 'FINANCE', 'EMPLOYEE'])
  }))
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to view templates
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const templates = await prisma.onboardingTemplate.findMany({
      where: { isActive: true },
      include: {
        tasks: {
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            workflows: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching onboarding templates:', error)
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

    // Check if user has permission to create templates
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createTemplateSchema.parse(body)

    // Check if template name already exists
    const existingTemplate = await prisma.onboardingTemplate.findUnique({
      where: { name: validatedData.name }
    })

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'Template with this name already exists' },
        { status: 400 }
      )
    }

    const template = await prisma.onboardingTemplate.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        tasks: {
          create: validatedData.tasks.map(task => ({
            title: task.title,
            description: task.description,
            category: task.category,
            isRequired: task.isRequired,
            order: task.order,
            daysToComplete: task.daysToComplete,
            assignedRole: task.assignedRole
          }))
        }
      },
      include: {
        tasks: {
          orderBy: { order: 'asc' }
        }
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        resource: 'ONBOARDING_TEMPLATE',
        resourceId: template.id,
        newValues: { templateName: template.name }
      }
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating onboarding template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
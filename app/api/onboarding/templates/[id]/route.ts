import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  tasks: z.array(z.object({
    id: z.string().optional(),
    title: z.string().min(1, 'Task title is required'),
    description: z.string().optional(),
    category: z.enum(['PERSONAL_INFO', 'DOCUMENTS', 'SYSTEM_ACCESS', 'TRAINING', 'COMPLIANCE', 'EQUIPMENT', 'INTRODUCTION']),
    isRequired: z.boolean().default(true),
    order: z.number().int().positive(),
    daysToComplete: z.number().int().positive().optional(),
    assignedRole: z.enum(['ADMIN', 'HR', 'MANAGER', 'FINANCE', 'EMPLOYEE'])
  }))
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const template = await prisma.onboardingTemplate.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            workflows: true
          }
        }
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error fetching onboarding template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update templates
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    
    const body = await request.json()
    const validatedData = updateTemplateSchema.parse(body)

    // Check if template exists
    const existingTemplate = await prisma.onboardingTemplate.findUnique({
      where: { id },
      include: { tasks: true }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check if name conflicts with another template
    if (validatedData.name !== existingTemplate.name) {
      const nameConflict = await prisma.onboardingTemplate.findFirst({
        where: {
          name: validatedData.name,
          id: { not: id }
        }
      })

      if (nameConflict) {
        return NextResponse.json(
          { error: 'Template with this name already exists' },
          { status: 400 }
        )
      }
    }

    // Update template and tasks in a transaction
    const template = await prisma.$transaction(async (tx) => {
      // Delete existing tasks
      await tx.onboardingTask.deleteMany({
        where: { templateId: id }
      })

      // Update template with new tasks
      return await tx.onboardingTemplate.update({
        where: { id },
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
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        resource: 'ONBOARDING_TEMPLATE',
        resourceId: template.id,
        oldValues: { templateName: existingTemplate.name },
        newValues: { templateName: template.name }
      }
    })

    return NextResponse.json({ template })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating onboarding template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete templates
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    
    // Check if template exists
    const template = await prisma.onboardingTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            workflows: true
          }
        }
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check if template is being used by any workflows
    if (template._count.workflows > 0) {
      return NextResponse.json(
        { error: 'Cannot delete template that is being used by active workflows' },
        { status: 400 }
      )
    }

    // Soft delete by setting isActive to false
    await prisma.onboardingTemplate.update({
      where: { id },
      data: { isActive: false }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        resource: 'ONBOARDING_TEMPLATE',
        resourceId: template.id,
        oldValues: { templateName: template.name }
      }
    })

    return NextResponse.json({ message: 'Template deleted successfully' })
  } catch (error) {
    console.error('Error deleting onboarding template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createWorkflowSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  templateId: z.string().min(1, 'Template ID is required'),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
  notes: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')

    // Build where clause based on user role and filters
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const whereClause: any = {}

    // Role-based filtering
    if (currentUser.role === 'EMPLOYEE' && currentUser.employee) {
      whereClause.employeeId = currentUser.employee.id
    } else if (currentUser.role === 'MANAGER' && currentUser.employee) {
      // Managers can see workflows for their subordinates
      const subordinates = await prisma.employee.findMany({
        where: { reportingTo: currentUser.employee.id },
        select: { id: true }
      })
      whereClause.employeeId = {
        in: [currentUser.employee.id, ...subordinates.map(s => s.id)]
      }
    }
    // HR and ADMIN can see all workflows

    // Apply additional filters
    if (employeeId) {
      whereClause.employeeId = employeeId
    }
    if (status) {
      whereClause.status = status
    }

    const workflows = await prisma.onboardingWorkflow.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            department: {
              select: { name: true }
            }
          }
        },
        template: {
          select: {
            name: true,
            description: true
          }
        },
        tasks: {
          include: {
            task: true
          },
          orderBy: {
            task: {
              order: 'asc'
            }
          }
        },
        approvals: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ workflows })
  } catch (error) {
    console.error('Error fetching onboarding workflows:', error)
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

    // Check if user has permission to create workflows
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createWorkflowSchema.parse(body)

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: validatedData.employeeId }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check if employee already has an onboarding workflow
    const existingWorkflow = await prisma.onboardingWorkflow.findUnique({
      where: { employeeId: validatedData.employeeId }
    })

    if (existingWorkflow) {
      return NextResponse.json(
        { error: 'Employee already has an onboarding workflow' },
        { status: 400 }
      )
    }

    // Check if template exists
    const template = await prisma.onboardingTemplate.findUnique({
      where: { id: validatedData.templateId },
      include: { tasks: true }
    })

    if (!template || !template.isActive) {
      return NextResponse.json({ error: 'Template not found or inactive' }, { status: 404 })
    }

    // Create workflow with tasks in a transaction
    const workflow = await prisma.$transaction(async (tx) => {
      const newWorkflow = await tx.onboardingWorkflow.create({
        data: {
          employeeId: validatedData.employeeId,
          templateId: validatedData.templateId,
          assignedTo: validatedData.assignedTo,
          dueDate: validatedData.dueDate,
          notes: validatedData.notes,
          status: 'PENDING'
        }
      })

      // Create workflow tasks based on template tasks
      const workflowTasks = await Promise.all(
        template.tasks.map(async (task) => {
          let dueDate: Date | undefined
          if (task.daysToComplete) {
            dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + task.daysToComplete)
          }

          return await tx.onboardingWorkflowTask.create({
            data: {
              workflowId: newWorkflow.id,
              taskId: task.id,
              status: 'PENDING',
              dueDate
            }
          })
        })
      )

      // Create approval requirements
      const requiredApprovers = ['HR', 'MANAGER'] // Default approvers
      await Promise.all(
        requiredApprovers.map(async (role) => {
          return await tx.onboardingApproval.create({
            data: {
              workflowId: newWorkflow.id,
              approverRole: role as any,
              status: 'PENDING'
            }
          })
        })
      )

      return newWorkflow
    })

    // Fetch the complete workflow with relations
    const completeWorkflow = await prisma.onboardingWorkflow.findUnique({
      where: { id: workflow.id },
      include: {
        employee: {
          include: {
            department: {
              select: { name: true }
            }
          }
        },
        template: {
          select: {
            name: true,
            description: true
          }
        },
        tasks: {
          include: {
            task: true
          },
          orderBy: {
            task: {
              order: 'asc'
            }
          }
        },
        approvals: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        resource: 'ONBOARDING_WORKFLOW',
        resourceId: workflow.id,
        newValues: { 
          employeeId: validatedData.employeeId,
          templateId: validatedData.templateId
        }
      }
    })

    return NextResponse.json({ workflow: completeWorkflow }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating onboarding workflow:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
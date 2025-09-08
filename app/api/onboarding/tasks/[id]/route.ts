import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateTaskSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'OVERDUE']),
  notes: z.string().optional(),
  documents: z.array(z.string()).optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateTaskSchema.parse(body)

    const { id } = await params
    
    // Find the workflow task
    const workflowTask = await prisma.onboardingWorkflowTask.findUnique({
      where: { id },
      include: {
        workflow: {
          include: {
            employee: {
              include: {
                user: true
              }
            }
          }
        },
        task: true
      }
    })

    if (!workflowTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const canUpdate = 
      // Admin and HR can update any task
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      // Employee can update their own tasks assigned to EMPLOYEE role
      (workflowTask.task.assignedRole === 'EMPLOYEE' && 
       workflowTask.workflow.employee.userId === session.user.id) ||
      // Manager can update tasks assigned to MANAGER role for their subordinates
      (workflowTask.task.assignedRole === 'MANAGER' && 
       currentUser.role === 'MANAGER' &&
       currentUser.employee &&
       workflowTask.workflow.employee.reportingTo === currentUser.employee.id) ||
      // Task is specifically assigned to this user
      workflowTask.assignedTo === session.user.id

    if (!canUpdate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update the task
    const updatedTask = await prisma.onboardingWorkflowTask.update({
      where: { id },
      data: {
        status: validatedData.status,
        notes: validatedData.notes,
        documents: validatedData.documents ? JSON.stringify(validatedData.documents) : undefined,
        startedAt: validatedData.status === 'IN_PROGRESS' && !workflowTask.startedAt 
          ? new Date() 
          : workflowTask.startedAt,
        completedAt: validatedData.status === 'COMPLETED' 
          ? new Date() 
          : null
      },
      include: {
        task: true,
        workflow: {
          include: {
            employee: {
              include: {
                department: {
                  select: { name: true }
                }
              }
            }
          }
        }
      }
    })

    // Check if workflow should be updated
    const allWorkflowTasks = await prisma.onboardingWorkflowTask.findMany({
      where: { workflowId: workflowTask.workflowId },
      include: { task: true }
    })

    const completedRequiredTasks = allWorkflowTasks.filter(
      t => t.task.isRequired && t.status === 'COMPLETED'
    ).length
    const totalRequiredTasks = allWorkflowTasks.filter(t => t.task.isRequired).length
    const allTasksCompleted = allWorkflowTasks.every(t => 
      t.status === 'COMPLETED' || t.status === 'SKIPPED'
    )

    // Update workflow status if needed
    let workflowStatus = workflowTask.workflow.status
    if (allTasksCompleted) {
      workflowStatus = 'COMPLETED'
    } else if (completedRequiredTasks > 0 && workflowStatus === 'PENDING') {
      workflowStatus = 'IN_PROGRESS'
    }

    if (workflowStatus !== workflowTask.workflow.status) {
      await prisma.onboardingWorkflow.update({
        where: { id: workflowTask.workflowId },
        data: {
          status: workflowStatus,
          completedAt: workflowStatus === 'COMPLETED' ? new Date() : null
        }
      })
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        resource: 'ONBOARDING_TASK',
        resourceId: updatedTask.id,
        oldValues: { 
          status: workflowTask.status,
          notes: workflowTask.notes
        },
        newValues: { 
          status: validatedData.status,
          notes: validatedData.notes
        }
      }
    })

    return NextResponse.json({ task: updatedTask })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating onboarding task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
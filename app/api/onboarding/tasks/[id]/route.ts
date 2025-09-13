import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/email-service'
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
                },
                user: {
                  select: { email: true }
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

    // Send email notifications for task completion
    try {
      if (validatedData.status === 'COMPLETED' && workflowTask.status !== 'COMPLETED') {
        const employee = updatedTask.workflow.employee;

        // Notify the employee about task completion
        if (employee.user?.email) {
          await emailService.sendEmail({
            to: employee.user.email,
            subject: 'Onboarding Task Completed',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">✅ Onboarding Task Completed</h2>
                <p>Hi ${employee.firstName},</p>
                <p>Great news! Your onboarding task has been completed:</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p><strong>Task:</strong> ${updatedTask.task.title}</p>
                  <p><strong>Category:</strong> ${updatedTask.task.category.replace('_', ' ')}</p>
                  ${updatedTask.task.description ? `<p><strong>Description:</strong> ${updatedTask.task.description}</p>` : ''}
                  ${validatedData.notes ? `<p><strong>Notes:</strong> ${validatedData.notes}</p>` : ''}
                </div>
                <p>You're making great progress with your onboarding! Keep up the good work.</p>
                <p>Best regards,<br>HR Team</p>
              </div>
            `,
            text: `Hi ${employee.firstName}, Your onboarding task "${updatedTask.task.title}" has been completed. ${validatedData.notes ? `Notes: ${validatedData.notes}` : ''}`
          });
        }

        // Notify HR about task completion
        const hrUsers = await prisma.user.findMany({
          where: {
            role: { in: ['HR', 'ADMIN'] },
            isActive: true
          },
          include: { employee: true }
        });

        for (const hrUser of hrUsers) {
          if (hrUser.email) {
            await emailService.sendEmail({
              to: hrUser.email,
              subject: 'Onboarding Task Completed',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #007bff;">📋 Onboarding Task Update</h2>
                  <p>Hi ${hrUser.employee?.firstName || 'HR Team'},</p>
                  <p>An onboarding task has been completed:</p>
                  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p><strong>Employee:</strong> ${employee.firstName} ${employee.lastName}</p>
                    <p><strong>Department:</strong> ${employee.department?.name || 'N/A'}</p>
                    <p><strong>Task:</strong> ${updatedTask.task.title}</p>
                    <p><strong>Category:</strong> ${updatedTask.task.category.replace('_', ' ')}</p>
                    ${validatedData.notes ? `<p><strong>Notes:</strong> ${validatedData.notes}</p>` : ''}
                  </div>
                  <p>Progress: ${completedRequiredTasks}/${totalRequiredTasks} required tasks completed</p>
                  ${workflowStatus === 'COMPLETED' ? '<p><strong>🎉 Onboarding workflow completed!</strong></p>' : ''}
                  <p>Best regards,<br>HR System</p>
                </div>
              `,
              text: `Onboarding task completed by ${employee.firstName} ${employee.lastName}: ${updatedTask.task.title}. Progress: ${completedRequiredTasks}/${totalRequiredTasks} required tasks.`
            });
          }
        }
      }

      // Send notification if entire workflow is completed
      if (workflowStatus === 'COMPLETED' && workflowTask.workflow.status !== 'COMPLETED') {
        const employee = updatedTask.workflow.employee;

        // Congratulate the employee
        if (employee.user?.email) {
          await emailService.sendEmail({
            to: employee.user.email,
            subject: '🎉 Onboarding Complete - Welcome to the Team!',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">🎉 Congratulations! Your Onboarding is Complete</h2>
                <p>Hi ${employee.firstName},</p>
                <p>We're excited to let you know that you've successfully completed your onboarding process!</p>
                <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                  <p><strong>✅ All onboarding tasks completed</strong></p>
                  <p><strong>✅ Welcome to ${employee.department?.name || 'the team'}!</strong></p>
                </div>
                <p>You're now fully set up and ready to contribute to our team. If you have any questions or need assistance, don't hesitate to reach out to your manager or HR.</p>
                <p>Welcome aboard!</p>
                <p>Best regards,<br>HR Team</p>
              </div>
            `,
            text: `Congratulations ${employee.firstName}! You've successfully completed your onboarding process. Welcome to the team!`
          });
        }
      }
    } catch (error) {
      console.warn('Failed to send onboarding task notification:', error);
    }

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
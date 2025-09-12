import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TaskStatus, UserRole } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Get pending onboarding tasks for the employee
    const onboardingTasks = await prisma.onboardingWorkflowTask.findMany({
      where: {
        OR: [
          // Tasks assigned to the employee
          {
            workflow: {
              employeeId: user.employee.id
            },
            task: {
              assignedRole: UserRole.EMPLOYEE
            },
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            }
          },
          // Tasks specifically assigned to this user
          {
            assignedTo: session.user.id,
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            }
          },
          // Manager tasks if user is a manager
          ...(user.role === 'MANAGER' ? [{
            workflow: {
              employee: {
                reportingTo: user.employee.id
              }
            },
            task: {
              assignedRole: UserRole.MANAGER
            },
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            }
          }] : []),
          // HR/Admin tasks
          ...((['ADMIN', 'HR'].includes(user.role)) ? [{
            task: {
              assignedRole: {
                in: [UserRole.HR, UserRole.ADMIN]
              }
            },
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            }
          }] : [])
        ]
      },
      include: {
        task: true,
        workflow: {
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeCode: true
              }
            }
          }
        }
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'asc' }
      ],
      take: limit
    })

    // Transform onboarding tasks to the expected format
    const tasks = onboardingTasks.map(wt => {
      const isOverdue = wt.dueDate && new Date(wt.dueDate) < new Date()
      
      return {
        id: wt.id,
        title: wt.task.title,
        description: wt.task.description || '',
        type: 'ONBOARDING' as const,
        priority: wt.task.isRequired ? 'HIGH' as const : 'MEDIUM' as const,
        dueDate: wt.dueDate?.toISOString(),
        assignedBy: {
          name: 'HR Team',
          role: 'Administrator'
        },
        status: isOverdue ? 'OVERDUE' as const : wt.status as 'PENDING' | 'IN_PROGRESS',
        progress: wt.status === 'IN_PROGRESS' ? 50 : 0,
        estimatedTime: wt.task.daysToComplete ? `${wt.task.daysToComplete} day(s)` : undefined,
        relatedEntity: {
          type: 'Employee',
          name: `${wt.workflow.employee.firstName} ${wt.workflow.employee.lastName}`
        }
      }
    })

    // Get total count and overdue count
    const totalCount = await prisma.onboardingWorkflowTask.count({
      where: {
        OR: [
          {
            workflow: {
              employeeId: user.employee.id
            },
            task: {
              assignedRole: UserRole.EMPLOYEE
            },
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            }
          },
          {
            assignedTo: session.user.id,
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            }
          },
          ...(user.role === 'MANAGER' ? [{
            workflow: {
              employee: {
                reportingTo: user.employee.id
              }
            },
            task: {
              assignedRole: UserRole.MANAGER
            },
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            }
          }] : []),
          ...((['ADMIN', 'HR'].includes(user.role)) ? [{
            task: {
              assignedRole: {
                in: [UserRole.HR, UserRole.ADMIN]
              }
            },
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            }
          }] : [])
        ]
      }
    })

    const overdueCount = await prisma.onboardingWorkflowTask.count({
      where: {
        OR: [
          {
            workflow: {
              employeeId: user.employee.id
            },
            task: {
              assignedRole: UserRole.EMPLOYEE
            },
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            },
            dueDate: {
              lt: new Date()
            }
          },
          {
            assignedTo: session.user.id,
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            },
            dueDate: {
              lt: new Date()
            }
          },
          ...(user.role === 'MANAGER' ? [{
            workflow: {
              employee: {
                reportingTo: user.employee.id
              }
            },
            task: {
              assignedRole: UserRole.MANAGER
            },
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            },
            dueDate: {
              lt: new Date()
            }
          }] : []),
          ...((['ADMIN', 'HR'].includes(user.role)) ? [{
            task: {
              assignedRole: {
                in: [UserRole.HR, UserRole.ADMIN]
              }
            },
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
            },
            dueDate: {
              lt: new Date()
            }
          }] : [])
        ]
      }
    })

    return NextResponse.json({
      tasks,
      totalCount,
      overdueCount
    })

  } catch (error) {
    console.error('Error fetching pending tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending tasks' },
      { status: 500 }
    )
  }
}

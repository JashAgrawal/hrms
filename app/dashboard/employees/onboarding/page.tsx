import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Plus,
  Settings,
  FileText,
  Calendar
} from 'lucide-react'
import Link from 'next/link'

async function getOnboardingStats(currentUser: any) {
  const whereClause: any = {}

  if (currentUser.role === 'EMPLOYEE' && currentUser.employee) {
    whereClause.employeeId = currentUser.employee.id
  } else if (currentUser.role === 'MANAGER' && currentUser.employee) {
    const subordinates = await prisma.employee.findMany({
      where: { reportingTo: currentUser.employee.id },
      select: { id: true }
    })
    whereClause.employeeId = {
      in: [currentUser.employee.id, ...subordinates.map(s => s.id)]
    }
  }

  const [totalWorkflows, pendingWorkflows, inProgressWorkflows, completedWorkflows, overdueWorkflows] = await Promise.all([
    prisma.onboardingWorkflow.count({ where: whereClause }),
    prisma.onboardingWorkflow.count({ where: { ...whereClause, status: 'PENDING' } }),
    prisma.onboardingWorkflow.count({ where: { ...whereClause, status: 'IN_PROGRESS' } }),
    prisma.onboardingWorkflow.count({ where: { ...whereClause, status: 'COMPLETED' } }),
    prisma.onboardingWorkflow.count({ where: { ...whereClause, status: 'OVERDUE' } })
  ])

  return {
    total: totalWorkflows,
    pending: pendingWorkflows,
    inProgress: inProgressWorkflows,
    completed: completedWorkflows,
    overdue: overdueWorkflows
  }
}

async function getRecentWorkflows(currentUser: any) {
  const whereClause: any = {}

  if (currentUser.role === 'EMPLOYEE' && currentUser.employee) {
    whereClause.employeeId = currentUser.employee.id
  } else if (currentUser.role === 'MANAGER' && currentUser.employee) {
    const subordinates = await prisma.employee.findMany({
      where: { reportingTo: currentUser.employee.id },
      select: { id: true }
    })
    whereClause.employeeId = {
      in: [currentUser.employee.id, ...subordinates.map(s => s.id)]
    }
  }

  return await prisma.onboardingWorkflow.findMany({
    where: whereClause,
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeCode: true,
          designation: true,
          department: {
            select: { name: true }
          }
        }
      },
      template: {
        select: { name: true }
      },
      tasks: {
        select: {
          status: true,
          task: {
            select: { isRequired: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })
}

async function getTemplates() {
  return await prisma.onboardingTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      _count: {
        select: {
          tasks: true,
          workflows: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export default async function OnboardingDashboard() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { employee: true }
  })

  if (!currentUser) {
    redirect('/auth/signin')
  }

  const [stats, recentWorkflows, templates] = await Promise.all([
    getOnboardingStats(currentUser),
    getRecentWorkflows(currentUser),
    ['ADMIN', 'HR'].includes(currentUser.role) ? getTemplates() : Promise.resolve([])
  ])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'OVERDUE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateProgress = (tasks: any[]) => {
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length
    return tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Onboarding</h1>
          <p className="text-muted-foreground">
            Manage employee onboarding workflows and track progress
          </p>
        </div>
        {['ADMIN', 'HR'].includes(currentUser.role) && (
          <div className="flex items-center gap-2">
            <Link href="/dashboard/employees/onboarding/templates">
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Manage Templates
              </Button>
            </Link>
            <Link href="/dashboard/employees/onboarding/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Start Onboarding
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Workflows */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Onboarding Workflows</CardTitle>
              <CardDescription>
                Latest onboarding activities and their progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentWorkflows.length > 0 ? (
                <div className="space-y-4">
                  {recentWorkflows.map((workflow) => {
                    const progress = calculateProgress(workflow.tasks)
                    return (
                      <div key={workflow.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">
                              {workflow.employee.firstName} {workflow.employee.lastName}
                            </h4>
                            <Badge variant="outline">
                              {workflow.employee.employeeCode}
                            </Badge>
                            <Badge className={getStatusColor(workflow.status)}>
                              {workflow.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {workflow.employee.designation} • {workflow.employee.department.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="flex-1 h-2" />
                            <span className="text-sm text-muted-foreground">
                              {Math.round(progress)}%
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <Link href={`/dashboard/employees/onboarding/${workflow.id}`}>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No onboarding workflows found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Templates (for HR/Admin) */}
        {['ADMIN', 'HR'].includes(currentUser.role) && (
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Onboarding Templates</CardTitle>
                <CardDescription>
                  Available templates for new employee onboarding
                </CardDescription>
              </CardHeader>
              <CardContent>
                {templates.length > 0 ? (
                  <div className="space-y-3">
                    {templates.map((template) => (
                      <div key={template.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{template.name}</h4>
                          <Badge variant="outline">
                            {template._count.tasks} tasks
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {template.description}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{template._count.workflows} workflows</span>
                          <Link href={`/dashboard/employees/onboarding/templates/${template.id}`}>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No templates available</p>
                    <Link href="/dashboard/employees/onboarding/templates/new">
                      <Button variant="outline" size="sm" className="mt-2">
                        Create Template
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
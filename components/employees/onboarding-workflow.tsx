'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  User, 
  Settings, 
  GraduationCap,
  Shield,
  Monitor,
  Users,
  Calendar,
  MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Textarea } from '../ui/textarea'

interface OnboardingTask {
  id: string
  title: string
  description?: string | null
  category: string
  isRequired: boolean
  order: number
  daysToComplete?: number | null
  assignedRole: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'OVERDUE'
  assignedTo?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
  dueDate?: Date | null
  notes?: string | null
  documents?: string[]
}

interface OnboardingWorkflow {
  id: string
  employeeId: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED'
  startDate: Date
  dueDate?: Date | null
  completedAt?: Date | null
  assignedTo?: string | null
  notes?: string | null
  tasks: OnboardingTask[]
  employee: {
    firstName: string
    lastName: string
    employeeCode: string
    designation: string
    joiningDate: Date
    department: {
      name: string
    }
  }
}

interface OnboardingWorkflowProps {
  workflow: OnboardingWorkflow
  currentUserRole: string
  currentUserId: string
  onUpdate?: () => void
}

const categoryIcons = {
  PERSONAL_INFO: User,
  DOCUMENTS: FileText,
  SYSTEM_ACCESS: Settings,
  TRAINING: GraduationCap,
  COMPLIANCE: Shield,
  EQUIPMENT: Monitor,
  INTRODUCTION: Users,
}

const statusColors = {
  PENDING: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  SKIPPED: 'bg-yellow-100 text-yellow-800',
  OVERDUE: 'bg-red-100 text-red-800',
}

export function OnboardingWorkflow({ 
  workflow, 
  currentUserRole, 
  currentUserId, 
  onUpdate 
}: OnboardingWorkflowProps) {
  const [selectedTask, setSelectedTask] = useState<OnboardingTask | null>(null)
  const [taskNotes, setTaskNotes] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const completedTasks = workflow.tasks.filter(task => task.status === 'COMPLETED').length
  const totalTasks = workflow.tasks.length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  const overdueTasks = workflow.tasks.filter(task => 
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED'
  ).length

  const canUpdateTask = (task: OnboardingTask) => {
    if (currentUserRole === 'ADMIN' || currentUserRole === 'HR') return true
    if (task.assignedRole === 'EMPLOYEE' && workflow.employeeId === currentUserId) return true
    if (task.assignedTo === currentUserId) return true
    return false
  }

  const updateTaskStatus = async (taskId: string, status: string, notes?: string) => {
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/onboarding/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, notes }),
      })

      if (!response.ok) {
        throw new Error('Failed to update task')
      }

      toast.success('Task updated successfully')
      onUpdate?.()
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Failed to update task')
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'OVERDUE':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const formatDaysRemaining = (dueDate: Date) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`
    } else if (diffDays === 0) {
      return 'Due today'
    } else {
      return `${diffDays} days remaining`
    }
  }

  return (
    <div className="space-y-6">
      {/* Workflow Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Onboarding Progress
              </CardTitle>
              <CardDescription>
                {workflow.employee.firstName} {workflow.employee.lastName} ({workflow.employee.employeeCode})
              </CardDescription>
            </div>
            <Badge variant={workflow.status === 'COMPLETED' ? 'default' : 'secondary'}>
              {workflow.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Employee Details</Label>
              <div className="text-sm text-muted-foreground">
                <p>{workflow.employee.designation}</p>
                <p>{workflow.employee.department.name}</p>
                <p>Joined: {new Date(workflow.employee.joiningDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Progress</Label>
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {completedTasks} of {totalTasks} tasks completed ({Math.round(progress)}%)
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <div className="text-sm text-muted-foreground">
                {overdueTasks > 0 && (
                  <p className="text-red-600 font-medium">
                    {overdueTasks} overdue task{overdueTasks > 1 ? 's' : ''}
                  </p>
                )}
                {workflow.dueDate && (
                  <p>Due: {new Date(workflow.dueDate).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks by Category */}
      {Object.entries(
        workflow.tasks.reduce((acc, task) => {
          if (!acc[task.category]) acc[task.category] = []
          acc[task.category].push(task)
          return acc
        }, {} as Record<string, OnboardingTask[]>)
      ).map(([category, tasks]) => {
        const CategoryIcon = categoryIcons[category as keyof typeof categoryIcons] || FileText
        const categoryCompleted = tasks.filter(task => task.status === 'COMPLETED').length
        const categoryProgress = tasks.length > 0 ? (categoryCompleted / tasks.length) * 100 : 0

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CategoryIcon className="h-5 w-5" />
                  {category.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {categoryCompleted}/{tasks.length}
                  </span>
                  <Progress value={categoryProgress} className="w-20 h-2" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasks
                  .sort((a, b) => a.order - b.order)
                  .map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        task.status === 'COMPLETED' && "bg-green-50 border-green-200",
                        task.status === 'OVERDUE' && "bg-red-50 border-red-200"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(task.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{task.title}</h4>
                            {task.isRequired && (
                              <Badge variant="outline" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <Badge className={statusColors[task.status]}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                            {task.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDaysRemaining(new Date(task.dueDate))}
                              </span>
                            )}
                            {task.assignedTo && (
                              <span>Assigned to: {task.assignedRole}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {canUpdateTask(task) && task.status !== 'COMPLETED' && (
                          <>
                            {task.status === 'PENDING' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateTaskStatus(task.id, 'IN_PROGRESS')}
                                disabled={isUpdating}
                              >
                                Start
                              </Button>
                            )}
                            {task.status === 'IN_PROGRESS' && (
                              <Button
                                size="sm"
                                onClick={() => updateTaskStatus(task.id, 'COMPLETED')}
                                disabled={isUpdating}
                              >
                                Complete
                              </Button>
                            )}
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedTask(task)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Task Details Modal */}
      {selectedTask && (
        <Card className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
            <CardHeader className="p-0">
              <CardTitle>{selectedTask.title}</CardTitle>
              <CardDescription>{selectedTask.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Status</Label>
                  <Badge className={statusColors[selectedTask.status]}>
                    {selectedTask.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <Label>Category</Label>
                  <p className="text-muted-foreground">
                    {selectedTask.category.replace('_', ' ')}
                  </p>
                </div>
                {selectedTask.dueDate && (
                  <div>
                    <Label>Due Date</Label>
                    <p className="text-muted-foreground">
                      {new Date(selectedTask.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div>
                  <Label>Assigned To</Label>
                  <p className="text-muted-foreground">{selectedTask.assignedRole}</p>
                </div>
              </div>
              
              {selectedTask.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {selectedTask.notes}
                  </p>
                </div>
              )}

              {canUpdateTask(selectedTask) && (
                <div className="space-y-2">
                  <Label htmlFor="taskNotes">Add Notes</Label>
                  <Textarea
                    id="taskNotes"
                    placeholder="Add notes or comments..."
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTask(null)
                  setTaskNotes('')
                }}
              >
                Close
              </Button>
              {canUpdateTask(selectedTask) && taskNotes && (
                <Button
                  onClick={() => {
                    updateTaskStatus(selectedTask.id, selectedTask.status, taskNotes)
                    setSelectedTask(null)
                    setTaskNotes('')
                  }}
                  disabled={isUpdating}
                >
                  Save Notes
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
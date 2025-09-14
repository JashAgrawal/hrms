"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckSquare, Clock, AlertCircle, User, FileText, Calendar } from "lucide-react"
import { useEffect, useState } from "react"
import { format, parseISO, differenceInDays, isPast } from "date-fns"

interface PendingTask {
  id: string
  title: string
  description: string
  type: 'ONBOARDING' | 'APPROVAL' | 'DOCUMENT' | 'TRAINING' | 'REVIEW' | 'COMPLIANCE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  assignedBy: {
    name: string
    role: string
  }
  status: 'PENDING' | 'IN_PROGRESS' | 'OVERDUE'
  progress?: number
  estimatedTime?: string
  relatedEntity?: {
    type: string
    name: string
  }
}

export function PendingTasksCard() {
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [totalTasks, setTotalTasks] = useState(0)
  const [overdueTasks, setOverdueTasks] = useState(0)

  useEffect(() => {
    const fetchPendingTasks = async () => {
      try {
        const response = await fetch('/api/tasks/pending?limit=6')
        
        if (response.ok) {
          const data = await response.json()
          setPendingTasks(data.tasks || [])
          setTotalTasks(data.totalCount || 0)
          setOverdueTasks(data.overdueCount || 0)
        } else {
          console.error('Failed to fetch pending tasks:', response.status)
          setPendingTasks([])
          setTotalTasks(0)
          setOverdueTasks(0)
        }
      } catch (error) {
        console.error('Failed to fetch pending tasks:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPendingTasks()
  }, [])

  const getTaskTypeBadge = (type: string) => {
    switch (type) {
      case 'ONBOARDING':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Onboarding</Badge>
      case 'APPROVAL':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approval</Badge>
      case 'DOCUMENT':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Document</Badge>
      case 'TRAINING':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Training</Badge>
      case 'REVIEW':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Review</Badge>
      case 'COMPLIANCE':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Compliance</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const getPriorityIcon = (priority: string, status: string) => {
    if (status === 'OVERDUE') {
      return <AlertCircle className="h-4 w-4 text-red-600" />
    }
    
    switch (priority) {
      case 'URGENT':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'HIGH':
        return <AlertCircle className="h-4 w-4 text-orange-600" />
      case 'MEDIUM':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'LOW':
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const formatDueDate = (dueDateString?: string) => {
    if (!dueDateString) return 'No due date'
    
    const dueDate = parseISO(dueDateString)
    const today = new Date()
    const daysDiff = differenceInDays(dueDate, today)
    
    if (isPast(dueDate) && daysDiff < 0) {
      return `Overdue by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''}`
    } else if (daysDiff === 0) {
      return 'Due today'
    } else if (daysDiff === 1) {
      return 'Due tomorrow'
    } else if (daysDiff <= 7) {
      return `Due in ${daysDiff} day${daysDiff > 1 ? 's' : ''}`
    } else {
      return `Due ${format(dueDate, 'MMM dd')}`
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OVERDUE':
        return 'border-l-red-500 bg-red-50'
      case 'IN_PROGRESS':
        return 'border-l-blue-500 bg-blue-50'
      case 'PENDING':
      default:
        return 'border-l-gray-300 bg-white'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Pending Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 p-3 border rounded">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-2 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Pending Tasks
          {totalTasks > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {totalTasks}
            </Badge>
          )}
        </CardTitle>
        {overdueTasks > 0 && (
          <p className="text-sm text-red-600">
            {overdueTasks} overdue task{overdueTasks > 1 ? 's' : ''}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingTasks.length === 0 ? (
          <div className="text-center py-6">
            <CheckSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No pending tasks
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You're all caught up!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <div 
                key={task.id} 
                className={`
                  p-3 rounded-lg border-l-4 transition-colors hover:shadow-sm
                  ${getStatusColor(task.status)}
                `}
              >
                <div className="flex items-start gap-3">
                  {getPriorityIcon(task.priority, task.status)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium truncate pr-2">
                        {task.title}
                      </h4>
                      {getTaskTypeBadge(task.type)}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-2">
                      {task.description}
                    </p>
                    
                    {task.progress !== undefined && task.progress > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Progress</span>
                          <span>{task.progress}%</span>
                        </div>
                        <Progress value={task.progress} className="h-1" />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{task.assignedBy.name}</span>
                        {task.estimatedTime && (
                          <>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>{task.estimatedTime}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span className={task.status === 'OVERDUE' ? 'text-red-600' : ''}>
                          {formatDueDate(task.dueDate)}
                        </span>
                      </div>
                    </div>
                    
                    {task.relatedEntity && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3 inline mr-1" />
                        {task.relatedEntity.type}: {task.relatedEntity.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {pendingTasks.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="text-xs">
                View All Tasks
              </Button>
              {overdueTasks > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-red-600">
                  Show Overdue Only
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="pt-3 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm font-semibold text-red-600">{overdueTasks}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-600">
                {pendingTasks.filter(t => t.status === 'IN_PROGRESS').length}
              </p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-600">
                {pendingTasks.filter(t => t.priority === 'HIGH' || t.priority === 'URGENT').length}
              </p>
              <p className="text-xs text-muted-foreground">High Priority</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
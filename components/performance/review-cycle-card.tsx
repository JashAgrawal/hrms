'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { 
  MoreHorizontal, 
  Edit, 
  Calendar, 
  Users, 
  Target,
  Play,
  Pause,
  Archive,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react'

interface PerformanceCycle {
  id: string
  name: string
  description?: string
  type: string
  startDate: string
  endDate: string
  dueDate: string
  status: string
  isActive: boolean
  template?: any
  _count: {
    reviews: number
    objectives: number
  }
}

interface ReviewCycleCardProps {
  cycle: PerformanceCycle
  onUpdate: () => void
  onEdit: (cycle: PerformanceCycle) => void
  onStatusChange: (cycleId: string, newStatus: string) => void
}

export function ReviewCycleCard({ 
  cycle, 
  onUpdate, 
  onEdit, 
  onStatusChange 
}: ReviewCycleCardProps) {
  const [loading, setLoading] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      case 'COMPLETED':
        return 'bg-purple-100 text-purple-800'
      case 'ARCHIVED':
        return 'bg-orange-100 text-orange-800'
      case 'CALIBRATION':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ANNUAL':
        return 'bg-blue-100 text-blue-800'
      case 'QUARTERLY':
        return 'bg-green-100 text-green-800'
      case 'HALF_YEARLY':
        return 'bg-purple-100 text-purple-800'
      case 'PROBATION':
        return 'bg-orange-100 text-orange-800'
      case 'MID_YEAR':
        return 'bg-teal-100 text-teal-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Play className="h-4 w-4 text-green-600" />
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-purple-600" />
      case 'DRAFT':
        return <Edit className="h-4 w-4 text-gray-600" />
      case 'CALIBRATION':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <Calendar className="h-4 w-4 text-gray-600" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const now = new Date()
    
    const startFormatted = formatDate(startDate)
    const endFormatted = formatDate(endDate)
    
    // Calculate progress
    const totalDuration = end.getTime() - start.getTime()
    const elapsed = now.getTime() - start.getTime()
    const progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
    
    return {
      range: `${startFormatted} - ${endFormatted}`,
      progress: Math.round(progress),
      isOverdue: now > end && cycle.status === 'ACTIVE'
    }
  }

  const dateInfo = formatDateRange(cycle.startDate, cycle.endDate)
  const dueDate = new Date(cycle.dueDate)
  const now = new Date()
  const isDueSoon = dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000 // 7 days

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true)
    try {
      await onStatusChange(cycle.id, newStatus)
    } finally {
      setLoading(false)
    }
  }

  const getAvailableActions = () => {
    const actions = []
    
    switch (cycle.status) {
      case 'DRAFT':
        actions.push({ label: 'Activate', action: () => handleStatusChange('ACTIVE'), icon: Play })
        break
      case 'ACTIVE':
        actions.push({ label: 'Move to Calibration', action: () => handleStatusChange('CALIBRATION'), icon: AlertTriangle })
        actions.push({ label: 'Pause', action: () => handleStatusChange('DRAFT'), icon: Pause })
        break
      case 'CALIBRATION':
        actions.push({ label: 'Complete', action: () => handleStatusChange('COMPLETED'), icon: CheckCircle2 })
        actions.push({ label: 'Back to Active', action: () => handleStatusChange('ACTIVE'), icon: Play })
        break
      case 'COMPLETED':
        actions.push({ label: 'Archive', action: () => handleStatusChange('ARCHIVED'), icon: Archive })
        break
    }
    
    return actions
  }

  const availableActions = getAvailableActions()

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {getStatusIcon(cycle.status)}
              <CardTitle className="text-lg">{cycle.name}</CardTitle>
              <Badge className={getStatusColor(cycle.status)}>
                {cycle.status.replace('_', ' ')}
              </Badge>
              <Badge className={getTypeColor(cycle.type)} variant="outline">
                {cycle.type.replace('_', ' ')}
              </Badge>
            </div>
            {cycle.description && (
              <p className="text-sm text-gray-600 mb-3">{cycle.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {dateInfo.range}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Due: {formatDate(cycle.dueDate)}
                {isDueSoon && cycle.status === 'ACTIVE' && (
                  <Badge variant="outline" className="ml-1 text-orange-600 border-orange-200">
                    Due Soon
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={loading}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(cycle)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Cycle
              </DropdownMenuItem>
              {availableActions.length > 0 && <DropdownMenuSeparator />}
              {availableActions.map((action, index) => (
                <DropdownMenuItem key={index} onClick={action.action}>
                  <action.icon className="h-4 w-4 mr-2" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Progress Bar */}
        {cycle.status === 'ACTIVE' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Cycle Progress</span>
              <span className="text-sm text-gray-600">{dateInfo.progress}%</span>
            </div>
            <Progress 
              value={dateInfo.progress} 
              className={`h-2 ${dateInfo.isOverdue ? 'bg-red-100' : ''}`}
            />
            {dateInfo.isOverdue && (
              <p className="text-xs text-red-600 mt-1">Cycle period has ended</p>
            )}
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-lg font-semibold text-blue-900">{cycle._count.reviews}</div>
              <div className="text-xs text-blue-700">Reviews</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
            <Target className="h-5 w-5 text-purple-600" />
            <div>
              <div className="text-lg font-semibold text-purple-900">{cycle._count.objectives}</div>
              <div className="text-xs text-purple-700">Objectives</div>
            </div>
          </div>
        </div>

        {/* Template Info */}
        {cycle.template && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-1">Review Template</div>
            <div className="text-xs text-gray-600">
              Custom template configured for this cycle
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
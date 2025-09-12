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
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  MoreHorizontal, 
  Edit, 
  Plus, 
  Calendar, 
  Target, 
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import { KeyResultForm } from './key-result-form'
import { ObjectiveUpdateForm } from './objective-update-form'

interface KeyResult {
  id: string
  title: string
  type: string
  status: string
  progress: number
  targetValue?: number
  currentValue?: number
  unit?: string
}

interface Objective {
  id: string
  title: string
  description?: string
  category: string
  priority: string
  weight: number
  status: string
  progress: number
  startDate: string
  endDate: string
  keyResults: KeyResult[]
  employee: {
    firstName: string
    lastName: string
    employeeCode: string
  }
}

interface ObjectiveCardProps {
  objective: Objective
  onUpdate: () => void
  onEdit: (objective: Objective) => void
}

export function ObjectiveCard({ objective, onUpdate, onEdit }: ObjectiveCardProps) {
  const [showKeyResultForm, setShowKeyResultForm] = useState(false)
  const [showUpdateForm, setShowUpdateForm] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'ON_TRACK':
        return 'bg-blue-100 text-blue-800'
      case 'AT_RISK':
        return 'bg-orange-100 text-orange-800'
      case 'BEHIND':
        return 'bg-red-100 text-red-800'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800'
      case 'LOW':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'ON_TRACK':
        return <TrendingUp className="h-4 w-4 text-blue-600" />
      case 'AT_RISK':
      case 'BEHIND':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      default:
        return <Target className="h-4 w-4 text-gray-600" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleKeyResultCreated = () => {
    setShowKeyResultForm(false)
    onUpdate()
  }

  const handleUpdateSubmitted = () => {
    setShowUpdateForm(false)
    onUpdate()
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(objective.status)}
                <CardTitle className="text-lg">{objective.title}</CardTitle>
                <Badge className={getStatusColor(objective.status)}>
                  {objective.status.replace('_', ' ')}
                </Badge>
              </div>
              {objective.description && (
                <p className="text-sm text-gray-600 mb-3">{objective.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(objective.startDate)} - {formatDate(objective.endDate)}
                </div>
                <Badge className={getPriorityColor(objective.priority)} variant="outline">
                  {objective.priority}
                </Badge>
                <span className="text-xs">Weight: {objective.weight}%</span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(objective)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Objective
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowUpdateForm(true)}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Update Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowKeyResultForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Key Result
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-gray-600">{objective.progress}%</span>
            </div>
            <Progress value={objective.progress} className="h-2" />
          </div>

          {/* Key Results */}
          {objective.keyResults.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Key Results ({objective.keyResults.length})</h4>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowKeyResultForm(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {objective.keyResults.map((keyResult) => (
                  <div 
                    key={keyResult.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{keyResult.title}</span>
                        <Badge 
                          variant="outline" 
                          className={getStatusColor(keyResult.status)}
                        >
                          {keyResult.status}
                        </Badge>
                      </div>
                      {keyResult.type === 'QUANTITATIVE' && (
                        <div className="text-xs text-gray-600">
                          {keyResult.currentValue || 0} / {keyResult.targetValue} {keyResult.unit}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{keyResult.progress}%</div>
                      <Progress value={keyResult.progress} className="w-16 h-1 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {objective.keyResults.length === 0 && (
            <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
              <Target className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">No key results yet</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowKeyResultForm(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Key Result
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Result Form Modal */}
      {showKeyResultForm && (
        <KeyResultForm
          objectiveId={objective.id}
          onSuccess={handleKeyResultCreated}
          onCancel={() => setShowKeyResultForm(false)}
        />
      )}

      {/* Objective Update Form Modal */}
      {showUpdateForm && (
        <ObjectiveUpdateForm
          objective={objective}
          onSuccess={handleUpdateSubmitted}
          onCancel={() => setShowUpdateForm(false)}
        />
      )}
    </>
  )
}
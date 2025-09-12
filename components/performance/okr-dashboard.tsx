'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Target, TrendingUp, Calendar, AlertTriangle } from 'lucide-react'
import { ObjectiveForm } from './objective-form'
import { KeyResultForm } from './key-result-form'
import { ObjectiveCard } from './objective-card'

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

interface OKRDashboardProps {
  employeeId?: string
  cycleId?: string
}

export function OKRDashboard({ employeeId, cycleId }: OKRDashboardProps) {
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [showObjectiveForm, setShowObjectiveForm] = useState(false)
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    fetchObjectives()
  }, [employeeId, cycleId])

  const fetchObjectives = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (employeeId) params.append('employeeId', employeeId)
      if (cycleId) params.append('cycleId', cycleId)
      
      const response = await fetch(`/api/performance/objectives?${params}`)
      if (response.ok) {
        const data = await response.json()
        setObjectives(data.objectives)
      }
    } catch (error) {
      console.error('Error fetching objectives:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleObjectiveCreated = () => {
    setShowObjectiveForm(false)
    fetchObjectives()
  }

  const handleObjectiveUpdated = () => {
    fetchObjectives()
  }

  // Calculate statistics
  const stats = {
    total: objectives.length,
    completed: objectives.filter(obj => obj.status === 'COMPLETED').length,
    onTrack: objectives.filter(obj => obj.status === 'ON_TRACK').length,
    atRisk: objectives.filter(obj => obj.status === 'AT_RISK').length,
    behind: objectives.filter(obj => obj.status === 'BEHIND').length,
    averageProgress: objectives.length > 0 
      ? objectives.reduce((sum, obj) => sum + obj.progress, 0) / objectives.length 
      : 0,
  }

  const filteredObjectives = objectives.filter(obj => {
    switch (activeTab) {
      case 'active':
        return ['ACTIVE', 'ON_TRACK'].includes(obj.status)
      case 'at-risk':
        return ['AT_RISK', 'BEHIND'].includes(obj.status)
      case 'completed':
        return obj.status === 'COMPLETED'
      default:
        return true
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">OKR Dashboard</h2>
          <p className="text-gray-600">Manage objectives and key results</p>
        </div>
        <Button onClick={() => setShowObjectiveForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Objective
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Objectives</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-600">
              {stats.completed} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageProgress.toFixed(1)}%</div>
            <Progress value={stats.averageProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Track</CardTitle>
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.onTrack}</div>
            <p className="text-xs text-gray-600">objectives</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.atRisk + stats.behind}</div>
            <p className="text-xs text-gray-600">need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Objectives List */}
      <Card>
        <CardHeader>
          <CardTitle>Objectives</CardTitle>
          <CardDescription>
            Track progress on your objectives and key results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({objectives.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({stats.onTrack})</TabsTrigger>
              <TabsTrigger value="at-risk">At Risk ({stats.atRisk + stats.behind})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {filteredObjectives.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No objectives found</h3>
                  <p className="text-gray-600 mb-4">
                    {activeTab === 'all' 
                      ? 'Create your first objective to get started'
                      : `No objectives in the ${activeTab} category`
                    }
                  </p>
                  {activeTab === 'all' && (
                    <Button onClick={() => setShowObjectiveForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Objective
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredObjectives.map((objective) => (
                    <ObjectiveCard
                      key={objective.id}
                      objective={objective}
                      onUpdate={handleObjectiveUpdated}
                      onEdit={setSelectedObjective}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Objective Form Modal */}
      {showObjectiveForm && (
        <ObjectiveForm
          employeeId={employeeId}
          cycleId={cycleId}
          onSuccess={handleObjectiveCreated}
          onCancel={() => setShowObjectiveForm(false)}
        />
      )}

      {/* Edit Objective Modal */}
      {selectedObjective && (
        <ObjectiveForm
          objective={selectedObjective}
          employeeId={employeeId}
          cycleId={cycleId}
          onSuccess={() => {
            setSelectedObjective(null)
            handleObjectiveUpdated()
          }}
          onCancel={() => setSelectedObjective(null)}
        />
      )}
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  BarChart3,
  Settings,
  Play,
  Pause,
  Archive
} from 'lucide-react'
import { ReviewCycleForm } from './review-cycle-form'
import { ReviewCycleCard } from './review-cycle-card'
import { ReviewAnalytics } from './review-analytics'

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

interface ReviewCycleDashboardProps {
  employeeId?: string
}

export function ReviewCycleDashboard({ employeeId }: ReviewCycleDashboardProps) {
  const [cycles, setCycles] = useState<PerformanceCycle[]>([])
  const [loading, setLoading] = useState(true)
  const [showCycleForm, setShowCycleForm] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState<PerformanceCycle | null>(null)
  const [activeTab, setActiveTab] = useState('active')

  useEffect(() => {
    fetchCycles()
  }, [])

  const fetchCycles = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeTab === 'active') {
        params.append('status', 'ACTIVE')
        params.append('isActive', 'true')
      } else if (activeTab === 'draft') {
        params.append('status', 'DRAFT')
      } else if (activeTab === 'completed') {
        params.append('status', 'COMPLETED')
      }
      
      const response = await fetch(`/api/performance/cycles?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCycles(data.cycles)
      }
    } catch (error) {
      console.error('Error fetching cycles:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCycles()
  }, [activeTab])

  const handleCycleCreated = () => {
    setShowCycleForm(false)
    fetchCycles()
  }

  const handleCycleUpdated = () => {
    fetchCycles()
  }

  const handleStatusChange = async (cycleId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/performance/cycles/${cycleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        fetchCycles()
      }
    } catch (error) {
      console.error('Error updating cycle status:', error)
    }
  }

  // Calculate statistics
  const stats = {
    total: cycles.length,
    active: cycles.filter(c => c.status === 'ACTIVE').length,
    draft: cycles.filter(c => c.status === 'DRAFT').length,
    completed: cycles.filter(c => c.status === 'COMPLETED').length,
    totalReviews: cycles.reduce((sum, c) => sum + c._count.reviews, 0),
    totalObjectives: cycles.reduce((sum, c) => sum + c._count.objectives, 0),
  }

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
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

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
          <h2 className="text-2xl font-bold text-gray-900">Review Cycles</h2>
          <p className="text-gray-600">Manage performance review cycles and workflows</p>
        </div>
        <Button onClick={() => setShowCycleForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Cycle
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cycles</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-600">
              {stats.active} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Reviews</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReviews}</div>
            <p className="text-xs text-gray-600">performance reviews</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Objectives</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalObjectives}</div>
            <p className="text-xs text-gray-600">linked objectives</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-gray-600">cycles completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Cycles List */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Cycles</CardTitle>
          <CardDescription>
            Manage review cycles, templates, and workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
              <TabsTrigger value="draft">Draft ({stats.draft})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-6">
              {cycles.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No active cycles</h3>
                  <p className="text-gray-600 mb-4">
                    Create a new performance review cycle to get started
                  </p>
                  <Button onClick={() => setShowCycleForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Cycle
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cycles.map((cycle) => (
                    <ReviewCycleCard
                      key={cycle.id}
                      cycle={cycle}
                      onUpdate={handleCycleUpdated}
                      onEdit={setSelectedCycle}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="draft" className="mt-6">
              {cycles.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No draft cycles</h3>
                  <p className="text-gray-600">
                    Draft cycles will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cycles.map((cycle) => (
                    <ReviewCycleCard
                      key={cycle.id}
                      cycle={cycle}
                      onUpdate={handleCycleUpdated}
                      onEdit={setSelectedCycle}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              {cycles.length === 0 ? (
                <div className="text-center py-8">
                  <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No completed cycles</h3>
                  <p className="text-gray-600">
                    Completed cycles will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cycles.map((cycle) => (
                    <ReviewCycleCard
                      key={cycle.id}
                      cycle={cycle}
                      onUpdate={handleCycleUpdated}
                      onEdit={setSelectedCycle}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <ReviewAnalytics />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Cycle Form Modal */}
      {showCycleForm && (
        <ReviewCycleForm
          onSuccess={handleCycleCreated}
          onCancel={() => setShowCycleForm(false)}
        />
      )}

      {/* Edit Cycle Modal */}
      {selectedCycle && (
        <ReviewCycleForm
          cycle={selectedCycle}
          onSuccess={() => {
            setSelectedCycle(null)
            handleCycleUpdated()
          }}
          onCancel={() => setSelectedCycle(null)}
        />
      )}
    </div>
  )
}
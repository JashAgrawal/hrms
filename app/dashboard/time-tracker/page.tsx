'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Clock, 
  FolderOpen, 
  TrendingUp, 
  Calendar, 
  Plus,
  BarChart3,
  Timer,
  CheckCircle,
  AlertCircle,
  Users
} from 'lucide-react'
import { formatHours, formatDate } from '@/components/time-tracker/shared/utils'

interface DashboardStats {
  totalHoursThisWeek: number
  totalHoursThisMonth: number
  activeProjects: number
  pendingTimesheets: number
  approvedTimesheets: number
  utilizationRate: number
}

interface RecentActivity {
  id: string
  type: 'timesheet' | 'project'
  title: string
  description: string
  date: string
  status: string
}

export default function TimeTrackerDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)

        // Fetch timesheet dashboard statistics
        const statsResponse = await fetch('/api/dashboard/timesheet/stats')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        } else {
          console.error('Failed to fetch timesheet dashboard stats')
        }

        // Fetch recent timesheet activities
        const activitiesResponse = await fetch('/api/timesheets?limit=5')
        if (activitiesResponse.ok) {
          const activitiesData = await activitiesResponse.json()
          const activities = (activitiesData.timesheets || []).map((timesheet: any) => ({
            id: timesheet.id,
            type: 'timesheet',
            title: `${timesheet.status === 'SUBMITTED' ? 'Submitted' : timesheet.status === 'APPROVED' ? 'Approved' : 'Draft'} Timesheet`,
            description: `Week of ${new Date(timesheet.startDate).toLocaleDateString()} - ${new Date(timesheet.endDate).toLocaleDateString()} • ${timesheet.totalHours || 0} hours`,
            date: timesheet.updatedAt,
            status: timesheet.status
          }))
          setRecentActivity(activities)
        } else {
          console.error('Failed to fetch timesheet activities:', await activitiesResponse.text())
        }
      } catch (error) {
        console.error('Error fetching timesheet dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Time Tracker</h1>
          <p className="text-muted-foreground">
            Manage your time, projects, and timesheets
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/time-tracker/timesheets">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Timesheet
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div className="text-sm font-medium text-muted-foreground">
                This Week
              </div>
            </div>
            <div className="text-2xl font-bold mt-2">
              {formatHours(stats?.totalHoursThisWeek || 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Target: 40h
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <div className="text-sm font-medium text-muted-foreground">
                This Month
              </div>
            </div>
            <div className="text-2xl font-bold mt-2">
              {formatHours(stats?.totalHoursThisMonth || 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Target: 160h
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-purple-600" />
              <div className="text-sm font-medium text-muted-foreground">
                Active Projects
              </div>
            </div>
            <div className="text-2xl font-bold mt-2">
              {stats?.activeProjects || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Assigned to you
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <div className="text-sm font-medium text-muted-foreground">
                Utilization
              </div>
            </div>
            <div className="text-2xl font-bold mt-2">
              {stats?.utilizationRate || 0}%
            </div>
            <Progress 
              value={stats?.utilizationRate || 0} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/time-tracker/timesheets">
              <Button variant="outline" className="w-full justify-start">
                <Clock className="h-4 w-4 mr-2" />
                Create Timesheet
              </Button>
            </Link>
            <Link href="/dashboard/time-tracker/projects">
              <Button variant="outline" className="w-full justify-start">
                <FolderOpen className="h-4 w-4 mr-2" />
                View Projects
              </Button>
            </Link>
            <Link href="/dashboard/time-tracker/reports">
              <Button variant="outline" className="w-full justify-start">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Reports
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Timesheet Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Timesheet Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">Pending</span>
              </div>
              <Badge variant="outline">
                {stats?.pendingTimesheets || 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Approved</span>
              </div>
              <Badge variant="outline">
                {stats?.approvedTimesheets || 0}
              </Badge>
            </div>
            <Link href="/dashboard/time-tracker/timesheets">
              <Button variant="outline" size="sm" className="w-full mt-4">
                View All Timesheets
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-full flex-shrink-0">
                  {activity.type === 'timesheet' ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{activity.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {activity.description}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDate(activity.date)}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {activity.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

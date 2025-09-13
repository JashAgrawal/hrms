'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  Plus, 
  TrendingUp, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Settings,
  Eye,
  BarChart3
} from 'lucide-react'
import { LeaveBalanceCard } from './dashboard/leave-balance-card'
import { QuickActionsCard } from './dashboard/quick-actions-card'
import { RecentActivityCard } from './dashboard/recent-activity-card'
import { PendingApprovalsCard } from './dashboard/pending-approvals-card'
import { TeamOverviewCard } from './dashboard/team-overview-card'
import { LeaveCalendarWidget } from './dashboard/leave-calendar-widget'
import { LeaveAnalyticsCard } from './dashboard/leave-analytics-card'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'

interface DashboardStats {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  rejectedRequests: number
  onLeaveToday: number
  teamAvailability: number
  myLeaveBalance: number
  upcomingLeaves: number
}

export function LeaveDashboard() {
  const { data: session } = useSession()
  const { hasRole } = usePermissions()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const isEmployee = hasRole('EMPLOYEE')
  const isManager = hasRole(['MANAGER', 'HR', 'ADMIN'])
  const isHR = hasRole(['HR', 'ADMIN'])
  const isAdmin = hasRole('ADMIN')

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leave/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground">
            {isEmployee && "Manage your leave requests and view balances"}
            {isManager && !isHR && "Oversee team leave requests and approvals"}
            {isHR && "Comprehensive leave management for your organization"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isEmployee ? "My Requests" : "Total Requests"}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendingRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isEmployee ? "My Balance" : "On Leave Today"}
            </CardTitle>
            {isEmployee ? (
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Users className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isEmployee ? (stats?.myLeaveBalance || 0) : (stats?.onLeaveToday || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {isEmployee ? "Days available" : "Currently unavailable"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isEmployee ? "Upcoming" : "Team Availability"}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isEmployee ? (stats?.upcomingLeaves || 0) : `${stats?.teamAvailability || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {isEmployee ? "Scheduled leaves" : "Available this week"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Personal Leave Balance - Always show for employees */}
        {isEmployee && (
          <div className="lg:col-span-1">
            <LeaveBalanceCard />
          </div>
        )}

        {/* Pending Approvals - Show for managers/HR */}
        {isManager && (
          <div className="lg:col-span-1">
            <PendingApprovalsCard />
          </div>
        )}

        {/* Team Overview - Show for managers/HR */}
        {isManager && (
          <div className="lg:col-span-1">
            <TeamOverviewCard />
          </div>
        )}

        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <QuickActionsCard />
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <RecentActivityCard />
        </div>

        {/* Calendar Widget */}
        <div className="lg:col-span-1">
          <LeaveCalendarWidget />
        </div>

        {/* Analytics - Show for HR/Admin */}
        {isHR && (
          <div className="lg:col-span-2">
            <LeaveAnalyticsCard />
          </div>
        )}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

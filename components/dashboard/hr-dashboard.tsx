"use client"
import {
  Users,
  UserPlus,
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import { StatsCard } from "./widgets/stats-card"
import { QuickActions } from "./widgets/quick-actions"
import { RecentActivity } from "./widgets/recent-activity"
import { useEffect, useState } from "react"

interface HRDashboardStats {
  totalEmployees: number
  newHires: number
  pendingOnboarding: number
  leaveRequests: number
  attendanceIssues: number
  documentsToReview: number
}

interface Activity {
  id: string
  user: { name: string; avatar: string }
  action: string
  target: string
  timestamp: Date
  status: 'success' | 'warning' | 'error' | 'info'
}

export function HRDashboard() {
  const [stats, setStats] = useState<HRDashboardStats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)

        // Fetch HR dashboard statistics
        const statsResponse = await fetch('/api/dashboard/hr/stats')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        } else {
          console.error('Failed to fetch HR dashboard stats')
        }

        // Fetch recent activities (HR-specific activities)
        const activitiesResponse = await fetch('/api/dashboard/activities?limit=10')
        if (activitiesResponse.ok) {
          const activitiesData = await activitiesResponse.json()
          setActivities(activitiesData.activities || [])
        } else {
          console.error('Failed to fetch activities')
        }
      } catch (error) {
        console.error('Error fetching HR dashboard data:', error)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])
  // Generate quick actions based on current stats
  const quickActions = [
    {
      title: "Review Leave Requests",
      description: `${stats?.leaveRequests || 0} pending approvals`,
      href: "/dashboard/leave/requests",
      icon: Calendar,
      variant: "default" as const
    },
    {
      title: "Employee Onboarding",
      description: `${stats?.pendingOnboarding || 0} employees in progress`,
      href: "/dashboard/onboarding",
      icon: UserPlus,
      variant: "secondary" as const
    },
    {
      title: "Attendance Issues",
      description: `${stats?.attendanceIssues || 0} issues to resolve`,
      href: "/dashboard/attendance/issues",
      icon: AlertCircle
    },
    {
      title: "Document Review",
      description: `${stats?.documentsToReview || 0} documents pending`,
      href: "/dashboard/documents/review",
      icon: FileText
    }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
        </div>
        <div className="text-center py-8">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">HR Dashboard</h1>
        <p className="text-muted-foreground">
          Employee management and HR operations overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Employees"
          value={(stats?.totalEmployees || 0).toLocaleString()}
          description="Active workforce"
          icon={Users}
          trend={{
            value: 2.3,
            label: "from last month",
            isPositive: true
          }}
        />
        <StatsCard
          title="New Hires"
          value={stats?.newHires || 0}
          description="This month"
          icon={UserPlus}
          trend={{
            value: 15.2,
            label: "from last month",
            isPositive: true
          }}
        />
        <StatsCard
          title="Leave Requests"
          value={stats?.leaveRequests || 0}
          description="Pending approval"
          icon={Calendar}
        />
        <StatsCard
          title="Onboarding Progress"
          value={`${stats?.pendingOnboarding || 0}`}
          description="In progress"
          icon={CheckCircle}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <QuickActions title="HR Actions" actions={quickActions} />
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <RecentActivity
            title="Recent Employee Activity"
            activities={activities}
            maxItems={6}
          />
        </div>
      </div>

      {/* HR Specific Widgets */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Department Overview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Department Overview</h3>
          <div className="space-y-3">
            <StatsCard
              title="Engineering"
              value="245"
              description="employees"
              icon={Users}
            />
            <StatsCard
              title="Sales"
              value="89"
              description="employees"
              icon={Users}
            />
            <StatsCard
              title="Marketing"
              value="34"
              description="employees"
              icon={Users}
            />
          </div>
        </div>

        {/* Leave Analytics */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Leave Analytics</h3>
          <div className="space-y-3">
            <StatsCard
              title="Annual Leave"
              value="68%"
              description="utilization rate"
              icon={Calendar}
            />
            <StatsCard
              title="Sick Leave"
              value="12%"
              description="utilization rate"
              icon={Calendar}
            />
            <StatsCard
              title="Casual Leave"
              value="45%"
              description="utilization rate"
              icon={Calendar}
            />
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Performance Metrics</h3>
          <div className="space-y-3">
            <StatsCard
              title="Avg. Performance"
              value="4.2/5"
              description="company-wide"
              icon={TrendingUp}
            />
            <StatsCard
              title="Reviews Completed"
              value="89%"
              description="this quarter"
              icon={CheckCircle}
            />
            <StatsCard
              title="Training Hours"
              value="1,245"
              description="this month"
              icon={FileText}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
"use client"
import {
  Users,
  Clock,
  Calendar,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Award
} from "lucide-react"
import { StatsCard } from "./widgets/stats-card"
import { QuickActions } from "./widgets/quick-actions"
import { RecentActivity } from "./widgets/recent-activity"
import { useEffect, useState } from "react"

interface ManagerDashboardStats {
  teamSize: number
  presentToday: number
  leaveRequests: number
  pendingReviews: number
  teamPerformance: number
  upcomingDeadlines: number
}

interface Activity {
  id: string
  user: { name: string; avatar: string }
  action: string
  target: string
  timestamp: Date
  status: 'success' | 'warning' | 'error' | 'info'
}

export function ManagerDashboard() {
  const [stats, setStats] = useState<ManagerDashboardStats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)

        // Fetch manager dashboard statistics
        const statsResponse = await fetch('/api/dashboard/manager/stats')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        } else {
          console.error('Failed to fetch manager dashboard stats')
        }

        // Fetch recent activities
        const activitiesResponse = await fetch('/api/dashboard/activities?limit=10')
        if (activitiesResponse.ok) {
          const activitiesData = await activitiesResponse.json()
          setActivities(activitiesData.activities || [])
        } else {
          console.error('Failed to fetch activities')
        }
      } catch (error) {
        console.error('Error fetching manager dashboard data:', error)
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
      title: "Approve Leave Requests",
      description: `${stats?.leaveRequests || 0} requests pending`,
      href: "/dashboard/leave/approvals",
      icon: Calendar,
      variant: "default" as const
    },
    {
      title: "Team Performance",
      description: "Review team OKRs and goals",
      href: "/dashboard/performance/team",
      icon: Target,
      variant: "secondary" as const
    },
    {
      title: "Conduct Reviews",
      description: `${stats?.pendingReviews || 0} reviews pending`,
      href: "/dashboard/performance/reviews",
      icon: Award
    },
    {
      title: "Team Attendance",
      description: "View team attendance patterns",
      href: "/dashboard/attendance/team",
      icon: Clock
    }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
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
          <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
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
        <h1 className="text-3xl font-bold">Manager Dashboard</h1>
        <p className="text-muted-foreground">
          Team overview and management tools
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Team Size"
          value={stats?.teamSize || 0}
          description="Direct reports"
          icon={Users}
        />
        <StatsCard
          title="Present Today"
          value={`${stats?.presentToday || 0}/${stats?.teamSize || 0}`}
          description={`${stats?.teamSize ? Math.round(((stats?.presentToday || 0) / stats.teamSize) * 100) : 0}% attendance`}
          icon={Clock}
          trend={{
            value: 5.2,
            label: "from yesterday",
            isPositive: true
          }}
        />
        <StatsCard
          title="Team Performance"
          value={stats?.teamPerformance ? `${stats.teamPerformance}/5` : 'N/A'}
          description="Average rating"
          icon={Target}
          trend={stats?.teamPerformance ? {
            value: 8.1,
            label: "from last quarter",
            isPositive: true
          } : undefined}
        />
        <StatsCard
          title="Pending Actions"
          value={(stats?.leaveRequests || 0) + (stats?.pendingReviews || 0)}
          description={`${stats?.leaveRequests || 0} leaves, ${stats?.pendingReviews || 0} reviews`}
          icon={AlertCircle}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <QuickActions title="Manager Actions" actions={quickActions} />
        </div>

        {/* Recent Team Activity */}
        <div className="lg:col-span-2">
          <RecentActivity
            title="Team Activity"
            activities={activities}
            maxItems={6}
          />
        </div>
      </div>

      {/* Team Insights */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Attendance */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Team Attendance</h3>
          <div className="space-y-3">
            <StatsCard
              title="This Week"
              value="94%"
              description="Average attendance"
              icon={Clock}
            />
            <StatsCard
              title="Late Arrivals"
              value="2"
              description="This week"
              icon={AlertCircle}
            />
            <StatsCard
              title="Early Departures"
              value="1"
              description="This week"
              icon={AlertCircle}
            />
          </div>
        </div>

        {/* Team Performance */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Performance Overview</h3>
          <div className="space-y-3">
            <StatsCard
              title="Goals Achieved"
              value="85%"
              description="This quarter"
              icon={Target}
            />
            <StatsCard
              title="Top Performer"
              value="Alice J."
              description="4.8/5 rating"
              icon={Award}
            />
            <StatsCard
              title="Improvement Needed"
              value="1"
              description="Team member"
              icon={TrendingUp}
            />
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Upcoming Events</h3>
          <div className="space-y-3">
            <StatsCard
              title="Team Meeting"
              value="Tomorrow"
              description="10:00 AM"
              icon={Users}
            />
            <StatsCard
              title="Review Deadline"
              value="3 days"
              description="Q4 Performance"
              icon={Calendar}
            />
            <StatsCard
              title="Project Deadline"
              value="1 week"
              description="Client deliverable"
              icon={CheckCircle}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
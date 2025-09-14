"use client"
import {
  Clock,
  Calendar,
  DollarSign,
  Receipt,
  Target,
  FileText,
  User,
  TrendingUp,
  Megaphone,
  Users
} from "lucide-react"
import {
  StatsCard,
  QuickActions,
  RecentActivity,
  YourInfoCard,
  HolidaysUpcomingLeavesCard,
  CheckInOutCard,
  MonthlyAttendancePreviewCard,
  LeaveReportCard,
  OnLeaveTodayCard,
  AnnouncementsCard,
  PendingTasksCard
} from "./widgets"
import { useEffect, useState } from "react"

interface DashboardStats {
  attendanceRate: number
  leaveBalance: number
  pendingExpenses: number
  lastSalary: number
  performanceRating: number
  documentsToSubmit: number
}

interface Activity {
  id: string
  user: { name: string; avatar: string }
  action: string
  target: string
  timestamp: Date
  status: 'success' | 'warning' | 'error'
}

export function EmployeeDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)

        // Fetch dashboard statistics
        const statsResponse = await fetch('/api/dashboard/employee/stats')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        } else {
          console.error('Failed to fetch dashboard stats')
        }

        // Fetch recent activities
        const activitiesResponse = await fetch('/api/dashboard/activities?limit=5')
        if (activitiesResponse.ok) {
          const activitiesData = await activitiesResponse.json()
          setActivities(activitiesData.activities || [])
        } else {
          console.error('Failed to fetch activities')
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
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
      title: "Mark Attendance",
      description: "Check in/out for today",
      href: "/dashboard/attendance",
      icon: Clock,
      variant: "default" as const
    },
    {
      title: "Apply for Leave",
      description: `${stats?.leaveBalance || 0} days available`,
      href: "/dashboard/leave/apply",
      icon: Calendar,
      variant: "secondary" as const
    },
    {
      title: "Submit Expense",
      description: "Upload receipts and claim expenses",
      href: "/dashboard/expenses",
      icon: Receipt
    },
    {
      title: "View Payslip",
      description: "Download latest salary slip",
      href: "/dashboard/payroll/my-payslips",
      icon: DollarSign
    }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
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
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
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
        <h1 className="text-3xl font-bold">Welcome back!</h1>
        <p className="text-muted-foreground">
          Here&apos;s your personal dashboard and quick actions
        </p>
      </div>

      {/* Stats Grid */}
      {/* <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Attendance Rate"
          value={`${stats?.attendanceRate || 0}%`}
          description="This month"
          icon={Clock}
          trend={{
            value: 2.1,
            label: "from last month",
            isPositive: true
          }}
        />
        <StatsCard
          title="Leave Balance"
          value={stats?.leaveBalance || 0}
          description="Days remaining"
          icon={Calendar}
        />
        <StatsCard
          title="Last Salary"
          value={`₹${((stats?.lastSalary || 0) / 1000).toFixed(0)}K`}
          description="Latest payslip"
          icon={DollarSign}
        />
        <StatsCard
          title="Performance"
          value={stats?.performanceRating ? `${stats.performanceRating}/5` : 'N/A'}
          description="Current rating"
          icon={Target}
          trend={stats?.performanceRating ? {
            value: 5.2,
            label: "from last review",
            isPositive: true
          } : undefined}
        />
      </div> */}

      {/* Quick Actions */}
      {/* <QuickActions title="Quick Actions" actions={quickActions} /> */}

      {/* Recent Activity */}
      {/* <RecentActivity title="Recent Activity" activities={activities} /> */}

      {/* Bento Grid Dashboard Layout */}
      {/*
        Responsive bento grid that adapts card sizes based on content density and importance:
        - Mobile: Single column stack
        - Tablet: 6-column grid with appropriate spans
        - Desktop: 12-column grid with optimized spacing

        Layout Strategy:
        - Large cards (5-6 cols): Content-heavy widgets like calendar, announcements
        - Medium cards (3-4 cols): Interactive widgets like check-in, tasks
        - Small cards (2-3 cols): Compact info widgets like profile, team status
      */}
      <div className="bento-grid">
        {/* Row 1: Primary Daily Actions & Overview */}

        {/* Monthly Attendance - Needs space for calendar grid */}
        <div className="col-span-1 md:col-span-6 lg:col-span-5">
          <MonthlyAttendancePreviewCard />
        </div>

        {/* Check In/Out - Important daily actions */}
        <div className="col-span-1 md:col-span-3 lg:col-span-4">
          <CheckInOutCard />
        </div>

        {/* Your Info - Compact profile information */}
        <div className="col-span-1 md:col-span-3 lg:col-span-3">
          <YourInfoCard />
        </div>

        {/* Row 2: Information-Dense Cards */}

        {/* Announcements - Multiple items, needs reading space */}
        <div className="col-span-1 md:col-span-6 lg:col-span-6">
          <AnnouncementsCard />
        </div>

        {/* Leave Report - Charts and data visualization */}
        <div className="col-span-1 md:col-span-6 lg:col-span-6">
          <LeaveReportCard />
        </div>

        {/* Row 3: Secondary Information & Team Awareness */}

        {/* Holidays & Upcoming Leaves */}
        <div className="col-span-1 md:col-span-3 lg:col-span-4">
          <HolidaysUpcomingLeavesCard />
        </div>

        {/* Pending Tasks */}
        <div className="col-span-1 md:col-span-3 lg:col-span-4">
          <PendingTasksCard />
        </div>

        {/* On Leave Today - Team awareness */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4">
          <OnLeaveTodayCard />
        </div>
      </div>

      {/* Secondary Content - Quick Actions & Activity */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-6 lg:grid-cols-12 mt-6">
        <div className="col-span-1 md:col-span-2 lg:col-span-4">
          <QuickActions title="Quick Actions" actions={quickActions} />
        </div>
        <div className="col-span-1 md:col-span-4 lg:col-span-8">
          <RecentActivity
            title="Recent Activity"
            activities={activities}
            maxItems={6}
          />
        </div>
      </div>

      {/* Personal Insights */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-3 lg:grid-cols-3">
        {/* This Month Summary */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">This Month</h3>
          <div className="space-y-3">
            <StatsCard
              title="Working Days"
              value="22/23"
              description="Days present"
              icon={Clock}
            />
            <StatsCard
              title="Overtime Hours"
              value="8.5"
              description="Extra hours worked"
              icon={TrendingUp}
            />
            <StatsCard
              title="Leaves Taken"
              value="2"
              description="Days off"
              icon={Calendar}
            />
          </div>
        </div>

        {/* Financial Summary */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Financial</h3>
          <div className="space-y-3">
            <StatsCard
              title="Pending Expenses"
              value={stats?.pendingExpenses || 0}
              description="Claims submitted"
              icon={Receipt}
            />
            <StatsCard
              title="YTD Earnings"
              value="₹10.2L"
              description="Total this year"
              icon={DollarSign}
            />
            <StatsCard
              title="Tax Saved"
              value="₹1.8L"
              description="Through investments"
              icon={DollarSign}
            />
          </div>
        </div>

        {/* Team & Tasks */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Team & Tasks</h3>
          <div className="space-y-3">
            <StatsCard
              title="On Leave Today"
              value={0}
              description="No one on leave"
              icon={Users}
            />
            <StatsCard
              title="Pending Tasks"
              value={stats?.documentsToSubmit || 0}
              description="Onboarding/assigned tasks"
              icon={FileText}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
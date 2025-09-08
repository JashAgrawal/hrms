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

// Mock data - in real app, this would come from API
const mockStats = {
  totalEmployees: 1247,
  newHires: 8,
  pendingOnboarding: 5,
  leaveRequests: 12,
  attendanceIssues: 3,
  documentsToReview: 7
}

const mockActivities = [
  {
    id: "1",
    user: { name: "John Smith", avatar: "" },
    action: "submitted leave request",
    target: "Annual Leave (5 days)",
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: "info" as const
  },
  {
    id: "2",
    user: { name: "Emma Wilson", avatar: "" },
    action: "completed onboarding",
    target: "Day 3 of 5",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: "success" as const
  },
  {
    id: "3",
    user: { name: "Michael Brown", avatar: "" },
    action: "uploaded document",
    target: "Medical Certificate",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    status: "info" as const
  },
  {
    id: "4",
    user: { name: "Sarah Davis", avatar: "" },
    action: "marked attendance",
    target: "Late arrival (9:15 AM)",
    timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000),
    status: "warning" as const
  }
]

const quickActions = [
  {
    title: "Review Leave Requests",
    description: `${mockStats.leaveRequests} pending approvals`,
    href: "/dashboard/leave/requests",
    icon: Calendar,
    variant: "default" as const
  },
  {
    title: "Employee Onboarding",
    description: `${mockStats.pendingOnboarding} employees in progress`,
    href: "/dashboard/onboarding",
    icon: UserPlus,
    variant: "secondary" as const
  },
  {
    title: "Attendance Issues",
    description: `${mockStats.attendanceIssues} issues to resolve`,
    href: "/dashboard/attendance/issues",
    icon: AlertCircle
  },
  {
    title: "Document Review",
    description: `${mockStats.documentsToReview} documents pending`,
    href: "/dashboard/documents/review",
    icon: FileText
  }
]

export function HRDashboard() {
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
          value={mockStats.totalEmployees.toLocaleString()}
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
          value={mockStats.newHires}
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
          value={mockStats.leaveRequests}
          description="Pending approval"
          icon={Calendar}
        />
        <StatsCard
          title="Onboarding Progress"
          value={`${mockStats.pendingOnboarding}/8`}
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
            activities={mockActivities}
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
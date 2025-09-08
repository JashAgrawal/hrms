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

// Mock data - in real app, this would come from API
const mockStats = {
  teamSize: 12,
  presentToday: 11,
  leaveRequests: 3,
  pendingReviews: 2,
  teamPerformance: 4.3,
  upcomingDeadlines: 5
}

const mockActivities = [
  {
    id: "1",
    user: { name: "Alice Johnson", avatar: "" },
    action: "submitted leave request",
    target: "Sick Leave (2 days)",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: "info" as const
  },
  {
    id: "2",
    user: { name: "Bob Smith", avatar: "" },
    action: "completed task",
    target: "Q4 Report Analysis",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    status: "success" as const
  },
  {
    id: "3",
    user: { name: "Carol Davis", avatar: "" },
    action: "checked in",
    target: "9:05 AM",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    status: "success" as const
  },
  {
    id: "4",
    user: { name: "David Wilson", avatar: "" },
    action: "updated OKR progress",
    target: "75% completion",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    status: "info" as const
  }
]

const quickActions = [
  {
    title: "Approve Leave Requests",
    description: `${mockStats.leaveRequests} requests pending`,
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
    description: `${mockStats.pendingReviews} reviews pending`,
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

export function ManagerDashboard() {
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
          value={mockStats.teamSize}
          description="Direct reports"
          icon={Users}
        />
        <StatsCard
          title="Present Today"
          value={`${mockStats.presentToday}/${mockStats.teamSize}`}
          description={`${Math.round((mockStats.presentToday / mockStats.teamSize) * 100)}% attendance`}
          icon={Clock}
          trend={{
            value: 5.2,
            label: "from yesterday",
            isPositive: true
          }}
        />
        <StatsCard
          title="Team Performance"
          value={`${mockStats.teamPerformance}/5`}
          description="Average rating"
          icon={Target}
          trend={{
            value: 8.1,
            label: "from last quarter",
            isPositive: true
          }}
        />
        <StatsCard
          title="Pending Actions"
          value={mockStats.leaveRequests + mockStats.pendingReviews}
          description={`${mockStats.leaveRequests} leaves, ${mockStats.pendingReviews} reviews`}
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
            activities={mockActivities}
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
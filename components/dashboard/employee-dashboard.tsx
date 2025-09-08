import { 
  Clock, 
  Calendar, 
  DollarSign, 
  Receipt,
  Target,
  FileText,
  User,
  TrendingUp
} from "lucide-react"
import { StatsCard } from "./widgets/stats-card"
import { QuickActions } from "./widgets/quick-actions"
import { RecentActivity } from "./widgets/recent-activity"

// Mock data - in real app, this would come from API
const mockStats = {
  attendanceRate: 96.5,
  leaveBalance: 18,
  pendingExpenses: 2,
  lastSalary: 85000,
  performanceRating: 4.2,
  documentsToSubmit: 1
}

const mockActivities = [
  {
    id: "1",
    user: { name: "You", avatar: "" },
    action: "checked in",
    target: "9:00 AM",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: "success" as const
  },
  {
    id: "2",
    user: { name: "HR Team", avatar: "" },
    action: "approved your leave request",
    target: "Dec 25-26",
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: "success" as const
  },
  {
    id: "3",
    user: { name: "Finance Team", avatar: "" },
    action: "processed your expense",
    target: "₹2,500 reimbursement",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: "success" as const
  },
  {
    id: "4",
    user: { name: "You", avatar: "" },
    action: "updated OKR progress",
    target: "Q4 Goals - 80%",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: "info" as const
  }
]

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
    description: `${mockStats.leaveBalance} days available`,
    href: "/dashboard/leave/apply",
    icon: Calendar,
    variant: "secondary" as const
  },
  {
    title: "Submit Expense",
    description: "Upload receipts and claim expenses",
    href: "/dashboard/expenses/new",
    icon: Receipt
  },
  {
    title: "View Payslip",
    description: "Download latest salary slip",
    href: "/dashboard/payroll/payslips",
    icon: DollarSign
  }
]

export function EmployeeDashboard() {
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Attendance Rate"
          value={`${mockStats.attendanceRate}%`}
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
          value={mockStats.leaveBalance}
          description="Days remaining"
          icon={Calendar}
        />
        <StatsCard
          title="Last Salary"
          value={`₹${(mockStats.lastSalary / 1000)}K`}
          description="December 2024"
          icon={DollarSign}
        />
        <StatsCard
          title="Performance"
          value={`${mockStats.performanceRating}/5`}
          description="Current rating"
          icon={Target}
          trend={{
            value: 5.2,
            label: "from last review",
            isPositive: true
          }}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <QuickActions title="Quick Actions" actions={quickActions} />
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <RecentActivity 
            title="Recent Activity" 
            activities={mockActivities}
            maxItems={6}
          />
        </div>
      </div>

      {/* Personal Insights */}
      <div className="grid gap-6 lg:grid-cols-3">
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
              value={mockStats.pendingExpenses}
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

        {/* Goals & Development */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Goals & Development</h3>
          <div className="space-y-3">
            <StatsCard
              title="OKR Progress"
              value="80%"
              description="Q4 objectives"
              icon={Target}
            />
            <StatsCard
              title="Training Hours"
              value="12"
              description="This quarter"
              icon={FileText}
            />
            <StatsCard
              title="Certifications"
              value="3"
              description="Completed this year"
              icon={User}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
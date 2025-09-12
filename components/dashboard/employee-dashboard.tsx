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
  const [upcomingLeaves, setUpcomingLeaves] = useState<{ name: string; date: string }[]>([])
  const [todayOnLeave, setTodayOnLeave] = useState<{ name: string }[]>([])
  const [pendingTasks, setPendingTasks] = useState<number>(0)
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; date: string }[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/leave/requests?status=APPROVED&limit=50')
        if (res.ok) {
          const data = await res.json()
          const now = new Date()
          const upcoming = (data.requests || [])
            .filter((r: any) => new Date(r.startDate) >= now)
            .slice(0, 5)
            .map((r: any) => ({
              name: `${r.employee.firstName} ${r.employee.lastName}`,
              date: new Date(r.startDate).toLocaleDateString()
            }))
          setUpcomingLeaves(upcoming)

          // Who is on leave today
          const today = new Date(); today.setHours(0,0,0,0)
          const onLeave = (data.requests || [])
            .filter((r: any) => {
              const s = new Date(r.startDate); const e = new Date(r.endDate)
              const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate())
              const ed = new Date(e.getFullYear(), e.getMonth(), e.getDate())
              return today >= sd && today <= ed
            })
            .slice(0, 10)
            .map((r: any) => ({ name: `${r.employee.firstName} ${r.employee.lastName}` }))
          setTodayOnLeave(onLeave)
        }
      } catch {}

      try {
        const wf = await fetch('/api/onboarding/workflows')
        if (wf.ok) {
          const data = await wf.json()
          const myPending = (data.workflows || [])
            .flatMap((w: any) => w.tasks || [])
            .filter((t: any) => t.status === 'PENDING').length
          setPendingTasks(myPending)
        }
      } catch {}

      setAnnouncements([
        { id: '1', title: 'Quarterly Townhall on Friday', date: new Date().toLocaleDateString() }
      ])
    }
    fetchData()
  }, [])

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
            activities={mockActivities}
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

        {/* Team & Tasks */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Team & Tasks</h3>
          <div className="space-y-3">
            <StatsCard
              title="On Leave Today"
              value={todayOnLeave.length}
              description={todayOnLeave.slice(0,3).map(p => p.name).join(', ') || '—'}
              icon={Users}
            />
            <StatsCard
              title="Pending Tasks"
              value={pendingTasks}
              description="Onboarding/assigned tasks"
              icon={FileText}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
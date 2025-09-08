import { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, Users, Settings, FileText, Clock, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Leave Management | Pekka HR',
  description: 'Comprehensive leave management system',
}

export default function LeaveManagementPage() {
  const features = [
    {
      title: 'Leave Requests',
      description: 'Submit and manage leave requests with approval workflows',
      icon: FileText,
      href: '/dashboard/leave/requests',
      color: 'bg-blue-500',
    },
    {
      title: 'Leave Calendar',
      description: 'View team leave schedules and identify conflicts',
      icon: Calendar,
      href: '/dashboard/leave/calendar',
      color: 'bg-green-500',
    },
    {
      title: 'Mobile Calendar',
      description: 'Mobile-friendly attendance and leave calendar view',
      icon: Calendar,
      href: '/dashboard/leave/mobile-calendar',
      color: 'bg-teal-500',
    },
    {
      title: 'Team Availability',
      description: 'Monitor team availability and plan resource allocation',
      icon: Users,
      href: '/dashboard/leave/availability',
      color: 'bg-purple-500',
    },
    {
      title: 'Leave Policies',
      description: 'Configure leave types, rules, and accrual settings',
      icon: Settings,
      href: '/dashboard/leave/policies',
      color: 'bg-orange-500',
    },
    {
      title: 'Leave Balances',
      description: 'Manage employee leave balances and accruals',
      icon: TrendingUp,
      href: '/dashboard/leave/balances',
      color: 'bg-indigo-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
        <p className="text-muted-foreground">
          Comprehensive leave management system for your organization
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">-</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Leave Today</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">-</div>
            <p className="text-xs text-muted-foreground">
              Currently unavailable
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Total leave days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Availability</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">-</div>
            <p className="text-xs text-muted-foreground">
              Average this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Card key={feature.href} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${feature.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={feature.href}>
                  <Button className="w-full">
                    Access {feature.title}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common leave management tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Link href="/dashboard/leave/requests">
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Submit Leave Request
              </Button>
            </Link>
            <Link href="/dashboard/leave/calendar">
              <Button variant="outline">
                <Calendar className="mr-2 h-4 w-4" />
                View Team Calendar
              </Button>
            </Link>
            <Link href="/dashboard/leave/availability">
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Check Team Availability
              </Button>
            </Link>
            <Link href="/dashboard/leave/policies">
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Manage Policies
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            New to leave management? Here's how to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                1
              </div>
              <div>
                <h4 className="font-medium">Configure Leave Policies</h4>
                <p className="text-sm text-muted-foreground">
                  Set up leave types, accrual rules, and approval workflows for your organization.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                2
              </div>
              <div>
                <h4 className="font-medium">Initialize Employee Balances</h4>
                <p className="text-sm text-muted-foreground">
                  Set up leave balances for all employees based on your policies.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                3
              </div>
              <div>
                <h4 className="font-medium">Start Managing Requests</h4>
                <p className="text-sm text-muted-foreground">
                  Employees can now submit leave requests and managers can approve them.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
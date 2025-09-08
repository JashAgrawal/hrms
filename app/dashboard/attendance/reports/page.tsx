import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AttendanceReports } from '@/components/attendance/attendance-reports'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, FileText, TrendingUp, Clock } from 'lucide-react'

export default async function AttendanceReportsPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Check if user has permission to view reports
  const userRole = (session.user as any)?.role
  if (!['ADMIN', 'HR', 'MANAGER'].includes(userRole)) {
    redirect('/dashboard/attendance')
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Attendance Reports</h2>
          <p className="text-muted-foreground">
            Generate and analyze attendance reports and analytics
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Summary Reports</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Overview</div>
            <p className="text-xs text-muted-foreground">
              Employee attendance summary
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Detailed Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Records</div>
            <p className="text-xs text-muted-foreground">
              Individual attendance records
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overtime Analysis</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Hours</div>
            <p className="text-xs text-muted-foreground">
              Overtime tracking and analysis
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trends & Analytics</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Insights</div>
            <p className="text-xs text-muted-foreground">
              Attendance trends and patterns
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reports Component */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Reports
          </CardTitle>
          <CardDescription>
            Create customized attendance reports with various filters and export options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<AttendanceReportsSkeleton />}>
            <AttendanceReports userRole={userRole} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

function AttendanceReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
      <div className="h-10 w-32 bg-muted animate-pulse rounded" />
      <div className="h-64 bg-muted animate-pulse rounded" />
    </div>
  )
}
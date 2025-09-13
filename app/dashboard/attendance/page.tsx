import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { UnifiedAttendanceTracker } from '@/components/attendance/unified-attendance-tracker'
import { AttendanceHistory } from '@/components/attendance/attendance-history'
import { AttendanceStats } from '@/components/attendance/attendance-stats'
import { AttendanceAbsenceManager } from '@/components/admin/attendance-absence-manager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, Calendar, TrendingUp, Users, Settings } from 'lucide-react'

export default async function AttendancePage() {
  const session = await auth()
  
  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Attendance</h2>
      </div>

      <Tabs defaultValue="tracker" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tracker" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Check In/Out
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Statistics
          </TabsTrigger>
          {(session.user.role === 'HR' || session.user.role === 'ADMIN' || session.user.role === 'MANAGER') && (
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
          )}
          {(session.user.role === 'HR' || session.user.role === 'ADMIN') && (
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tracker" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Suspense fallback={<AttendanceStatsSkeleton />}>
              <AttendanceStats />
            </Suspense>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Today's Attendance
              </CardTitle>
              <CardDescription>
                Mark your attendance with automatic GPS verification when available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<AttendanceTrackerSkeleton />}>
                <UnifiedAttendanceTracker />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Attendance History
              </CardTitle>
              <CardDescription>
                View your past attendance records and work hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<AttendanceHistorySkeleton />}>
                <AttendanceHistory />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">22/23</div>
                <p className="text-xs text-muted-foreground">
                  Days present
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Hours</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8.2h</div>
                <p className="text-xs text-muted-foreground">
                  Per working day
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overtime</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12.5h</div>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {(session.user.role === 'HR' || session.user.role === 'ADMIN' || session.user.role === 'MANAGER') && (
          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Attendance
                </CardTitle>
                <CardDescription>
                  Monitor and manage team attendance records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Team attendance management coming soon...
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {(session.user.role === 'HR' || session.user.role === 'ADMIN') && (
          <TabsContent value="admin" className="space-y-4">
            <AttendanceAbsenceManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// Loading skeletons
function AttendanceStatsSkeleton() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-4 w-4 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ))}
    </>
  )
}

function AttendanceTrackerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 bg-muted animate-pulse rounded" />
      <div className="flex gap-4">
        <div className="h-10 w-24 bg-muted animate-pulse rounded" />
        <div className="h-10 w-24 bg-muted animate-pulse rounded" />
      </div>
    </div>
  )
}

function AttendanceHistorySkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 border rounded">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-3 w-32 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-6 w-16 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  )
}
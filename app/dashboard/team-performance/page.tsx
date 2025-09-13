import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Target,
  Award,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle,
  Building2
} from 'lucide-react'

async function getTeamPerformanceData(userId: string, userRole: string) {
  try {
    // Get current user's employee record
    const currentEmployee = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true, departmentId: true }
    })

    if (!currentEmployee) {
      return null
    }

    // Determine which employees to include based on role
    let employeeFilter: any = {}
    
    if (userRole === 'ADMIN' || userRole === 'HR') {
      // Admin and HR can see all employees
      employeeFilter = { status: 'ACTIVE' }
    } else if (userRole === 'MANAGER') {
      // Managers can see their direct reports and department colleagues
      employeeFilter = {
        status: 'ACTIVE',
        OR: [
          { reportingTo: currentEmployee.id }, // Direct reports
          { departmentId: currentEmployee.departmentId } // Same department
        ]
      }
    } else {
      // Regular employees can only see their department
      employeeFilter = {
        status: 'ACTIVE',
        departmentId: currentEmployee.departmentId
      }
    }

    // Get team members
    const teamMembers = await prisma.employee.findMany({
      where: employeeFilter,
      include: {
        department: {
          select: { name: true, code: true }
        },
        user: {
          select: { role: true }
        }
      },
      orderBy: { firstName: 'asc' }
    })

    // Get attendance data for the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const attendanceData = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: teamMembers.map(emp => emp.id) },
        date: { gte: thirtyDaysAgo }
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    })

    // Get leave data for the last 30 days
    const leaveData = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: teamMembers.map(emp => emp.id) },
        startDate: { gte: thirtyDaysAgo },
        status: 'APPROVED'
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    })

    // Calculate performance metrics
    const performanceMetrics = teamMembers.map(employee => {
      const employeeAttendance = attendanceData.filter(att => att.employeeId === employee.id)
      const employeeLeaves = leaveData.filter(leave => leave.employeeId === employee.id)
      
      const totalWorkingDays = 30 // Simplified calculation
      const presentDays = employeeAttendance.filter(att => att.status === 'PRESENT').length
      const lateDays = employeeAttendance.filter(att => att.status === 'LATE').length
      const leaveDays = employeeLeaves.reduce((sum, leave: any) => {
        const start = new Date(leave.startDate)
        const end = new Date(leave.endDate)
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        return sum + diffDays
      }, 0)

      const attendanceRate = ((presentDays / (totalWorkingDays - leaveDays)) * 100) || 0
      const punctualityRate = (((presentDays - lateDays) / presentDays) * 100) || 0

      return {
        employee,
        metrics: {
          attendanceRate: Math.min(100, Math.round(attendanceRate)),
          punctualityRate: Math.min(100, Math.round(punctualityRate)),
          presentDays,
          lateDays,
          leaveDays,
          totalWorkingDays: totalWorkingDays - leaveDays
        }
      }
    })

    // Calculate department-wise statistics
    const departmentStats = teamMembers.reduce((acc, employee) => {
      const deptName = employee.department.name
      if (!acc[deptName]) {
        acc[deptName] = {
          name: deptName,
          code: employee.department.code,
          employeeCount: 0,
          totalAttendanceRate: 0,
          totalPunctualityRate: 0
        }
      }
      
      const empMetrics = performanceMetrics.find(p => p.employee.id === employee.id)?.metrics
      if (empMetrics) {
        acc[deptName].employeeCount++
        acc[deptName].totalAttendanceRate += empMetrics.attendanceRate
        acc[deptName].totalPunctualityRate += empMetrics.punctualityRate
      }
      
      return acc
    }, {} as Record<string, any>)

    // Calculate averages
    Object.values(departmentStats).forEach((dept: any) => {
      dept.avgAttendanceRate = Math.round(dept.totalAttendanceRate / dept.employeeCount)
      dept.avgPunctualityRate = Math.round(dept.totalPunctualityRate / dept.employeeCount)
    })

    return {
      teamMembers: performanceMetrics,
      departmentStats: Object.values(departmentStats),
      summary: {
        totalEmployees: teamMembers.length,
        avgAttendanceRate: Math.round(
          performanceMetrics.reduce((sum, p) => sum + p.metrics.attendanceRate, 0) / performanceMetrics.length
        ),
        avgPunctualityRate: Math.round(
          performanceMetrics.reduce((sum, p) => sum + p.metrics.punctualityRate, 0) / performanceMetrics.length
        ),
        topPerformers: performanceMetrics
          .sort((a, b) => (b.metrics.attendanceRate + b.metrics.punctualityRate) - (a.metrics.attendanceRate + a.metrics.punctualityRate))
          .slice(0, 5)
      }
    }
  } catch (error) {
    console.error('Error fetching team performance data:', error)
    return null
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default async function TeamPerformancePage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const performanceData = await getTeamPerformanceData(session.user.id, session.user.role)

  if (!performanceData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Performance</h1>
          <p className="text-muted-foreground">
            Track and analyze team performance metrics
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-muted-foreground">Unable to load performance data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Performance</h1>
        <p className="text-muted-foreground">
          Track and analyze team performance metrics and attendance patterns
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.summary.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Active employees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.summary.avgAttendanceRate}%</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Punctuality</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.summary.avgPunctualityRate}%</div>
            <p className="text-xs text-muted-foreground">
              On-time arrivals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.summary.topPerformers.length}</div>
            <p className="text-xs text-muted-foreground">
              High achievers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="individual">Individual Performance</TabsTrigger>
          <TabsTrigger value="departments">Department Analysis</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Top Performers
                </CardTitle>
                <CardDescription>
                  Employees with highest combined attendance and punctuality scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceData.summary.topPerformers.map((performer, index) => (
                    <div key={performer.employee.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">
                            {performer.employee.firstName} {performer.employee.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {performer.employee.designation}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {Math.round((performer.metrics.attendanceRate + performer.metrics.punctualityRate) / 2)}%
                        </p>
                        <p className="text-sm text-muted-foreground">Overall Score</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Department Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Department Performance
                </CardTitle>
                <CardDescription>
                  Average performance metrics by department
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceData.departmentStats.map((dept: any) => (
                    <div key={dept.code} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{dept.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {dept.employeeCount} employees
                          </p>
                        </div>
                        <Badge variant="outline">
                          {dept.avgAttendanceRate}% attendance
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Attendance</span>
                          <span>{dept.avgAttendanceRate}%</span>
                        </div>
                        <Progress value={dept.avgAttendanceRate} className="h-2" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Punctuality</span>
                          <span>{dept.avgPunctualityRate}%</span>
                        </div>
                        <Progress value={dept.avgPunctualityRate} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="individual">
          <Card>
            <CardHeader>
              <CardTitle>Individual Performance Metrics</CardTitle>
              <CardDescription>
                Detailed performance breakdown for each team member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {performanceData.teamMembers.map((member) => (
                  <div key={member.employee.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium">
                          {member.employee.firstName} {member.employee.lastName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {member.employee.designation} • {member.employee.department.name}
                        </p>
                      </div>
                      <Badge className={member.employee.user.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
                        {member.employee.user.role}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {member.metrics.attendanceRate}%
                        </p>
                        <p className="text-sm text-muted-foreground">Attendance</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {member.metrics.punctualityRate}%
                        </p>
                        <p className="text-sm text-muted-foreground">Punctuality</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">
                          {member.metrics.presentDays}
                        </p>
                        <p className="text-sm text-muted-foreground">Present Days</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {member.metrics.lateDays}
                        </p>
                        <p className="text-sm text-muted-foreground">Late Days</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle>Department Analysis</CardTitle>
              <CardDescription>
                Comparative analysis of department performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {performanceData.departmentStats.map((dept: any) => (
                  <div key={dept.code} className="border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium">{dept.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {dept.code} • {dept.employeeCount} employees
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {Math.round((dept.avgAttendanceRate + dept.avgPunctualityRate) / 2)}%
                        </p>
                        <p className="text-sm text-muted-foreground">Overall Score</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Attendance Rate</span>
                          <span className="text-sm">{dept.avgAttendanceRate}%</span>
                        </div>
                        <Progress value={dept.avgAttendanceRate} className="h-3" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Punctuality Rate</span>
                          <span className="text-sm">{dept.avgPunctualityRate}%</span>
                        </div>
                        <Progress value={dept.avgPunctualityRate} className="h-3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Trends
              </CardTitle>
              <CardDescription>
                Historical performance trends and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Trends Analysis Coming Soon
                </h3>
                <p className="text-gray-600 mb-4">
                  Historical trend analysis and predictive insights will be available in a future update
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

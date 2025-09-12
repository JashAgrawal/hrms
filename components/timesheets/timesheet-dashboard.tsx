'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'
import { 
  Clock, 
  TrendingUp, 
  Users, 
  Calendar, 
  Target,
  DollarSign,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Download
} from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns'

interface DashboardData {
  summary: {
    totalHours: number
    billableHours: number
    nonBillableHours: number
    overtimeHours: number
    utilizationRate: number
    averageHoursPerDay: number
    totalProjects: number
    activeEmployees: number
  }
  trends: {
    date: string
    totalHours: number
    billableHours: number
    nonBillableHours: number
    overtimeHours: number
  }[]
  projectUtilization: {
    projectName: string
    projectCode: string
    totalHours: number
    billableHours: number
    utilizationRate: number
    employeeCount: number
  }[]
  employeeProductivity: {
    employeeName: string
    employeeId: string
    totalHours: number
    billableHours: number
    utilizationRate: number
    projectCount: number
  }[]
  statusDistribution: {
    status: string
    count: number
    percentage: number
  }[]
  weeklyComparison: {
    week: string
    currentYear: number
    previousYear: number
  }[]
}

interface TimesheetDashboardProps {
  dateRange: {
    startDate: string
    endDate: string
  }
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void
  userRole: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ADMIN'
}

export function TimesheetDashboard({ 
  dateRange, 
  onDateRangeChange, 
  userRole 
}: TimesheetDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState('totalHours')
  const [viewType, setViewType] = useState('overview')

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        viewType
      })

      const res = await fetch(`/api/timesheets/analytics?${params}`)
      if (!res.ok) throw new Error('Failed to fetch dashboard data')
      
      const dashboardData = await res.json()
      setData(dashboardData)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [dateRange, viewType])

  // Quick date range presets
  const setQuickRange = (days: number) => {
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    onDateRangeChange({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd')
    })
  }

  const setCurrentWeek = () => {
    const now = new Date()
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    onDateRangeChange({
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd')
    })
  }

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Timesheet Analytics</h2>
          <p className="text-muted-foreground">
            {format(new Date(dateRange.startDate), 'MMM dd')} - {format(new Date(dateRange.endDate), 'MMM dd, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewType} onValueChange={setViewType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              {userRole !== 'EMPLOYEE' && (
                <>
                  <SelectItem value="team">Team View</SelectItem>
                  <SelectItem value="projects">Projects</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setQuickRange(7)}>
              7D
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange(30)}>
              30D
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange(90)}>
              90D
            </Button>
            <Button variant="outline" size="sm" onClick={setCurrentWeek}>
              This Week
            </Button>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                <p className="text-3xl font-bold">{data.summary.totalHours.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">
                  {data.summary.averageHoursPerDay.toFixed(1)} avg/day
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Billable Hours</p>
                <p className="text-3xl font-bold">{data.summary.billableHours.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">
                  {((data.summary.billableHours / data.summary.totalHours) * 100).toFixed(1)}% of total
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Utilization Rate</p>
                <p className="text-3xl font-bold">{data.summary.utilizationRate.toFixed(1)}%</p>
                <Progress value={data.summary.utilizationRate} className="mt-2" />
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Projects</p>
                <p className="text-3xl font-bold">{data.summary.totalProjects}</p>
                <p className="text-sm text-muted-foreground">
                  {data.summary.activeEmployees} employees
                </p>
              </div>
              <Activity className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs value={selectedMetric} onValueChange={setSelectedMetric}>
        <TabsList>
          <TabsTrigger value="totalHours">Hours Trend</TabsTrigger>
          <TabsTrigger value="projects">Project Utilization</TabsTrigger>
          {userRole !== 'EMPLOYEE' && (
            <TabsTrigger value="team">Team Productivity</TabsTrigger>
          )}
          <TabsTrigger value="status">Status Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="totalHours" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Hours Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="billableHours" 
                    stackId="1"
                    stroke="#0088FE" 
                    fill="#0088FE" 
                    fillOpacity={0.6}
                    name="Billable Hours"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="nonBillableHours" 
                    stackId="1"
                    stroke="#00C49F" 
                    fill="#00C49F" 
                    fillOpacity={0.6}
                    name="Non-billable Hours"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="overtimeHours" 
                    stackId="1"
                    stroke="#FFBB28" 
                    fill="#FFBB28" 
                    fillOpacity={0.6}
                    name="Overtime Hours"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Project Utilization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.projectUtilization}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="projectCode" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="totalHours" fill="#0088FE" name="Total Hours" />
                  <Bar dataKey="billableHours" fill="#00C49F" name="Billable Hours" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Project Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.projectUtilization.map((project, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{project.projectName}</span>
                        <Badge variant="outline">{project.projectCode}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {project.employeeCount} employees • {project.totalHours.toFixed(1)} total hours
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{project.utilizationRate.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">utilization</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {userRole !== 'EMPLOYEE' && (
          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Productivity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.employeeProductivity.map((employee, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{employee.employeeName}</span>
                          <Badge variant="outline">{employee.employeeId}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {employee.projectCount} projects • {employee.totalHours.toFixed(1)} total hours
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{employee.billableHours.toFixed(1)}h</p>
                        <p className="text-sm text-muted-foreground">
                          {employee.utilizationRate.toFixed(1)}% utilization
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.status} (${entry.percentage.toFixed(1)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {data.statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.statusDistribution.map((status, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{status.status}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{status.count}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({status.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Weekly Comparison */}
      {data.weeklyComparison.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Weekly Comparison (Year over Year)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.weeklyComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="currentYear" 
                  stroke="#0088FE" 
                  strokeWidth={2}
                  name="Current Year"
                />
                <Line 
                  type="monotone" 
                  dataKey="previousYear" 
                  stroke="#00C49F" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Previous Year"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Users, 
  FolderOpen,
  Filter
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { toast } from 'sonner'

interface TimeReportData {
  totalHours: number
  billableHours: number
  nonBillableHours: number
  overtimeHours: number
  projectBreakdown: {
    projectId: string
    projectName: string
    projectCode: string
    hours: number
    percentage: number
  }[]
  dailyBreakdown: {
    date: string
    hours: number
    billableHours: number
    nonBillableHours: number
    overtimeHours: number
  }[]
  employeeBreakdown?: {
    employeeId: string
    employeeName: string
    employeeCode: string
    totalHours: number
    billableHours: number
    utilizationRate: number
  }[]
}

export default function TimeTrackerReportsPage() {
  const [reportData, setReportData] = useState<TimeReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    projectId: '',
    employeeId: '',
    reportType: 'personal'
  })

  // Fetch report data
  const fetchReportData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })

      const res = await fetch(`/api/reports/timesheet?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch report data')

      const data = await res.json()
      setReportData(data)
    } catch (error) {
      console.error('Error fetching report data:', error)
      toast.error('Failed to fetch report data')
    } finally {
      setLoading(false)
    }
  }

  // Export report
  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      params.append('format', format)

      const res = await fetch(`/api/reports/timesheet/export?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to export report')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `timesheet-report-${filters.startDate}-to-${filters.endDate}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Report exported as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Error exporting report:', error)
      toast.error('Failed to export report')
    }
  }

  // Quick date filters
  const setQuickFilter = (type: 'thisMonth' | 'lastMonth' | 'thisQuarter') => {
    const now = new Date()
    let startDate: Date
    let endDate: Date

    switch (type) {
      case 'thisMonth':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case 'lastMonth':
        const lastMonth = subMonths(now, 1)
        startDate = startOfMonth(lastMonth)
        endDate = endOfMonth(lastMonth)
        break
      case 'thisQuarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        startDate = quarterStart
        endDate = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0)
        break
      default:
        return
    }

    setFilters(prev => ({
      ...prev,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd')
    }))
  }

  useEffect(() => {
    fetchReportData()
  }, [filters])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time Reports</h1>
          <p className="text-muted-foreground">
            Analyze time tracking data and generate insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportType">Report Type</Label>
              <Select
                value={filters.reportType}
                onValueChange={(value) => setFilters(prev => ({ ...prev, reportType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal Report</SelectItem>
                  <SelectItem value="team">Team Report</SelectItem>
                  <SelectItem value="project">Project Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quick Filters</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickFilter('thisMonth')}
                >
                  This Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickFilter('lastMonth')}
                >
                  Last Month
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <div className="text-sm font-medium text-muted-foreground">
                  Total Hours
                </div>
              </div>
              <div className="text-2xl font-bold mt-2">
                {reportData.totalHours.toFixed(1)}h
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <div className="text-sm font-medium text-muted-foreground">
                  Billable Hours
                </div>
              </div>
              <div className="text-2xl font-bold mt-2">
                {reportData.billableHours.toFixed(1)}h
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {reportData.totalHours > 0 
                  ? `${((reportData.billableHours / reportData.totalHours) * 100).toFixed(1)}% of total`
                  : '0% of total'
                }
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <div className="text-sm font-medium text-muted-foreground">
                  Non-Billable Hours
                </div>
              </div>
              <div className="text-2xl font-bold mt-2">
                {reportData.nonBillableHours.toFixed(1)}h
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-orange-600" />
                <div className="text-sm font-medium text-muted-foreground">
                  Overtime Hours
                </div>
              </div>
              <div className="text-2xl font-bold mt-2">
                {reportData.overtimeHours.toFixed(1)}h
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Tabs */}
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">Project Breakdown</TabsTrigger>
          <TabsTrigger value="daily">Daily Breakdown</TabsTrigger>
          {filters.reportType === 'team' && (
            <TabsTrigger value="employees">Employee Breakdown</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Project Time Distribution
              </CardTitle>
              <CardDescription>
                Time spent across different projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading report data...</div>
                </div>
              ) : reportData?.projectBreakdown.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.projectBreakdown.map((project) => (
                        <TableRow key={project.projectId}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{project.projectName}</div>
                              <div className="text-sm text-muted-foreground">
                                {project.projectCode}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{project.hours.toFixed(1)}h</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${project.percentage}%` }}
                                />
                              </div>
                              <span className="text-sm">{project.percentage.toFixed(1)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No project data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Daily Time Breakdown
              </CardTitle>
              <CardDescription>
                Daily time tracking summary
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading report data...</div>
                </div>
              ) : reportData?.dailyBreakdown.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Billable</TableHead>
                        <TableHead>Non-Billable</TableHead>
                        <TableHead>Overtime</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.dailyBreakdown.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>
                            {format(new Date(day.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>{day.hours.toFixed(1)}h</TableCell>
                          <TableCell>{day.billableHours.toFixed(1)}h</TableCell>
                          <TableCell>{day.nonBillableHours.toFixed(1)}h</TableCell>
                          <TableCell>{day.overtimeHours.toFixed(1)}h</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No daily data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {filters.reportType === 'team' && (
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Employee Performance
                </CardTitle>
                <CardDescription>
                  Team member time tracking summary
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading report data...</div>
                  </div>
                ) : reportData?.employeeBreakdown?.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Total Hours</TableHead>
                          <TableHead>Billable Hours</TableHead>
                          <TableHead>Utilization Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.employeeBreakdown.map((employee) => (
                          <TableRow key={employee.employeeId}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{employee.employeeName}</div>
                                <div className="text-sm text-muted-foreground">
                                  {employee.employeeCode}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{employee.totalHours.toFixed(1)}h</TableCell>
                            <TableCell>{employee.billableHours.toFixed(1)}h</TableCell>
                            <TableCell>
                              <Badge variant={employee.utilizationRate >= 80 ? 'default' : 'secondary'}>
                                {employee.utilizationRate.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No employee data available for the selected period
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
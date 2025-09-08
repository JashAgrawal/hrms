'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  Download, 
  FileText, 
  TrendingUp, 
  Clock, 
  Users, 
  Calendar,
  Filter
} from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { toast } from 'sonner'

interface AttendanceReportsProps {
  userRole: string
}

interface ReportFilters {
  type: 'summary' | 'detailed' | 'overtime' | 'trends'
  period: 'daily' | 'weekly' | 'monthly' | 'custom'
  startDate: string
  endDate: string
  employeeId?: string
  departmentId?: string
  format: 'json' | 'csv'
}

interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  department: { name: string }
}

interface Department {
  id: string
  name: string
}

export function AttendanceReports({ userRole }: AttendanceReportsProps) {
  const [filters, setFilters] = useState<ReportFilters>({
    type: 'summary',
    period: 'monthly',
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    format: 'json'
  })
  
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  // Fetch employees and departments for filters
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        if (userRole === 'ADMIN' || userRole === 'HR') {
          const [employeesRes, departmentsRes] = await Promise.all([
            fetch('/api/employees'),
            fetch('/api/departments')
          ])
          
          if (employeesRes.ok) {
            const employeesData = await employeesRes.json()
            setEmployees(employeesData.employees || [])
          }
          
          if (departmentsRes.ok) {
            const departmentsData = await departmentsRes.json()
            setDepartments(departmentsData.departments || [])
          }
        }
      } catch (error) {
        console.error('Error fetching filter data:', error)
      }
    }

    fetchFilterData()
  }, [userRole])

  const generateReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })

      const response = await fetch(`/api/attendance/reports?${params}`)
      
      if (response.ok) {
        if (filters.format === 'csv') {
          // Handle CSV download
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
          a.click()
          window.URL.revokeObjectURL(url)
          toast.success('Report downloaded successfully')
        } else {
          const data = await response.json()
          setReportData(data.data)
          toast.success('Report generated successfully')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    
    // Auto-adjust date range based on period
    if (key === 'period') {
      const now = new Date()
      let startDate: Date
      let endDate: Date

      switch (value) {
        case 'daily':
          startDate = new Date(now)
          endDate = new Date(now)
          break
        case 'weekly':
          startDate = new Date(now.setDate(now.getDate() - now.getDay()))
          endDate = new Date(now.setDate(now.getDate() - now.getDay() + 6))
          break
        case 'monthly':
        default:
          startDate = startOfMonth(new Date())
          endDate = endOfMonth(new Date())
          break
      }

      if (value !== 'custom') {
        setFilters(prev => ({
          ...prev,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd')
        }))
      }
    }
  }

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-green-100 text-green-800'
      case 'LATE':
        return 'bg-yellow-100 text-yellow-800'
      case 'ABSENT':
        return 'bg-red-100 text-red-800'
      case 'HALF_DAY':
        return 'bg-orange-100 text-orange-800'
      case 'WORK_FROM_HOME':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={filters.type} onValueChange={(value: any) => handleFilterChange('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary Report</SelectItem>
                  <SelectItem value="detailed">Detailed Report</SelectItem>
                  <SelectItem value="overtime">Overtime Report</SelectItem>
                  <SelectItem value="trends">Trends Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={filters.period} onValueChange={(value: any) => handleFilterChange('period', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Today</SelectItem>
                  <SelectItem value="weekly">This Week</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                disabled={filters.period !== 'custom'}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                disabled={filters.period !== 'custom'}
              />
            </div>

            {(userRole === 'ADMIN' || userRole === 'HR') && (
              <>
                <div className="space-y-2">
                  <Label>Employee (Optional)</Label>
                  <Select value={filters.employeeId || ''} onValueChange={(value) => handleFilterChange('employeeId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Employees</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.employeeCode} - {emp.firstName} {emp.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Department (Optional)</Label>
                  <Select value={filters.departmentId || ''} onValueChange={(value) => handleFilterChange('departmentId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Departments</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={filters.format} onValueChange={(value: any) => handleFilterChange('format', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">View Online</SelectItem>
                  <SelectItem value="csv">Download CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <Button onClick={generateReport} disabled={loading} className="flex items-center gap-2">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>

            {reportData && filters.format === 'json' && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setFilters(prev => ({ ...prev, format: 'csv' }))
                  generateReport()
                }}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {reportData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Report Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                {filters.type === 'trends' && <TabsTrigger value="trends">Trends</TabsTrigger>}
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                {renderSummaryView()}
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                {renderDetailsView()}
              </TabsContent>

              {filters.type === 'trends' && (
                <TabsContent value="trends" className="space-y-4">
                  {renderTrendsView()}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )

  function renderSummaryView() {
    if (!reportData) return null

    if (filters.type === 'summary' && reportData.summary) {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold">{reportData.summary.totalEmployees}</div>
                    <p className="text-xs text-muted-foreground">Total Employees</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold">{reportData.summary.workingDays}</div>
                    <p className="text-xs text-muted-foreground">Working Days</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold">{Math.round(reportData.summary.averageAttendanceRate)}%</div>
                    <p className="text-xs text-muted-foreground">Avg Attendance</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold">{formatHours(reportData.summary.totalOvertime)}</div>
                    <p className="text-xs text-muted-foreground">Total Overtime</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    return <div className="text-center py-8 text-muted-foreground">No summary data available</div>
  }

  function renderDetailsView() {
    if (!reportData) return null

    let records = []
    if (filters.type === 'summary' && reportData.employeeStats) {
      records = reportData.employeeStats
    } else if (filters.type === 'detailed' && reportData.records) {
      records = reportData.records
    } else if (filters.type === 'overtime' && reportData.detailedRecords) {
      records = reportData.detailedRecords
    }

    if (records.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">No detailed data available</div>
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {filters.type === 'summary' ? (
                <>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Present Days</TableHead>
                  <TableHead>Attendance Rate</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Overtime</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Overtime</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.slice(0, 50).map((record: any, index: number) => (
              <TableRow key={index}>
                {filters.type === 'summary' ? (
                  <>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.employee.firstName} {record.employee.lastName}</div>
                        <div className="text-sm text-muted-foreground">{record.employee.employeeCode}</div>
                      </div>
                    </TableCell>
                    <TableCell>{record.employee.department.name}</TableCell>
                    <TableCell>{record.presentDays}/{record.totalDays}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={record.attendanceRate} className="w-16" />
                        <span className="text-sm">{record.attendanceRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatHours(record.totalHours)}</TableCell>
                    <TableCell className="text-orange-600">{formatHours(record.totalOvertime)}</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>{format(new Date(record.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.employee.firstName} {record.employee.lastName}</div>
                        <div className="text-sm text-muted-foreground">{record.employee.employeeCode}</div>
                      </div>
                    </TableCell>
                    <TableCell>{record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '-'}</TableCell>
                    <TableCell>{record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(record.status)}>
                        {record.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatHours(record.workHours || 0)}</TableCell>
                    <TableCell className="text-orange-600">{formatHours(record.overtime || 0)}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {records.length > 50 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Showing first 50 records. Download CSV for complete data.
          </div>
        )}
      </div>
    )
  }

  function renderTrendsView() {
    if (!reportData?.dailyTrends) {
      return <div className="text-center py-8 text-muted-foreground">No trends data available</div>
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">Peak Attendance Day</h4>
              {reportData.periodSummary.peakAttendanceDay && (
                <div>
                  <div className="text-lg font-bold">{reportData.periodSummary.peakAttendanceDay.attendanceRate}%</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(reportData.periodSummary.peakAttendanceDay.date), 'MMM dd, yyyy')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">Lowest Attendance Day</h4>
              {reportData.periodSummary.lowestAttendanceDay && (
                <div>
                  <div className="text-lg font-bold">{reportData.periodSummary.lowestAttendanceDay.attendanceRate}%</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(reportData.periodSummary.lowestAttendanceDay.date), 'MMM dd, yyyy')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Total Employees</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Attendance Rate</TableHead>
                <TableHead>Avg Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.dailyTrends.map((day: any, index: number) => (
                <TableRow key={index}>
                  <TableCell>{format(new Date(day.date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{day.totalEmployees}</TableCell>
                  <TableCell className="text-green-600">{day.present || 0}</TableCell>
                  <TableCell className="text-yellow-600">{day.late || 0}</TableCell>
                  <TableCell className="text-red-600">{day.absent || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={day.attendanceRate} className="w-16" />
                      <span className="text-sm">{day.attendanceRate}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatHours(day.averageHours || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }
}
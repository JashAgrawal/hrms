'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw as Sync,
  Download,
  Upload,
  Users,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import { format, differenceInHours, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

interface AttendanceRecord {
  id: string
  date: string
  checkIn?: string
  checkOut?: string
  totalHours: number
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_DEPARTURE' | 'OVERTIME'
  breaks: Array<{
    startTime: string
    endTime: string
    duration: number
  }>
}

interface TimesheetEntry {
  id: string
  date: string
  startTime: string
  endTime: string
  breakDuration: number
  totalHours: number
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED'
}

interface DiscrepancyItem {
  date: string
  type: 'MISSING_TIMESHEET' | 'MISSING_ATTENDANCE' | 'TIME_MISMATCH' | 'BREAK_MISMATCH'
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  description: string
  attendanceHours?: number
  timesheetHours?: number
  suggestedAction: string
}

interface AttendanceIntegrationProps {
  employeeId?: string
  dateRange: {
    startDate: string
    endDate: string
  }
  onSyncData: () => Promise<void>
  onGenerateTimesheet: (attendanceRecords: AttendanceRecord[]) => Promise<void>
}

export function AttendanceIntegration({
  employeeId,
  dateRange,
  onSyncData,
  onGenerateTimesheet
}: AttendanceIntegrationProps) {
  const { toast } = useToast()
  
  // State management
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([])
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        ...(employeeId && { employeeId })
      })

      const [attendanceRes, timesheetRes] = await Promise.all([
        fetch(`/api/attendance?${params}`),
        fetch(`/api/timesheets?${params}`)
      ])

      if (!attendanceRes.ok || !timesheetRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const [attendanceData, timesheetData] = await Promise.all([
        attendanceRes.json(),
        timesheetRes.json()
      ])

      setAttendanceRecords(attendanceData.records || [])
      setTimesheetEntries(timesheetData.timesheets?.flatMap((ts: any) => ts.entries) || [])
      
      // Analyze discrepancies
      analyzeDiscrepancies(attendanceData.records || [], timesheetData.timesheets?.flatMap((ts: any) => ts.entries) || [])
      
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load attendance and timesheet data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateRange, employeeId])

  // Analyze discrepancies between attendance and timesheet data
  const analyzeDiscrepancies = (attendance: AttendanceRecord[], timesheet: TimesheetEntry[]) => {
    const discrepancyList: DiscrepancyItem[] = []
    
    // Create date maps for easy lookup
    const attendanceMap = new Map(attendance.map(record => [record.date, record]))
    const timesheetMap = new Map(timesheet.map(entry => [entry.date, entry]))
    
    // Get all unique dates
    const allDates = new Set([
      ...attendance.map(r => r.date),
      ...timesheet.map(e => e.date)
    ])
    
    allDates.forEach(date => {
      const attendanceRecord = attendanceMap.get(date)
      const timesheetEntry = timesheetMap.get(date)
      
      // Missing timesheet entry
      if (attendanceRecord && !timesheetEntry && attendanceRecord.status === 'PRESENT') {
        discrepancyList.push({
          date,
          type: 'MISSING_TIMESHEET',
          severity: 'HIGH',
          description: `No timesheet entry found for attendance record`,
          attendanceHours: attendanceRecord.totalHours,
          suggestedAction: 'Create timesheet entry from attendance data'
        })
      }
      
      // Missing attendance record
      if (timesheetEntry && !attendanceRecord) {
        discrepancyList.push({
          date,
          type: 'MISSING_ATTENDANCE',
          severity: 'MEDIUM',
          description: `No attendance record found for timesheet entry`,
          timesheetHours: timesheetEntry.totalHours,
          suggestedAction: 'Verify attendance or update timesheet'
        })
      }
      
      // Time mismatch
      if (attendanceRecord && timesheetEntry) {
        const hoursDiff = Math.abs(attendanceRecord.totalHours - timesheetEntry.totalHours)
        
        if (hoursDiff > 0.5) { // More than 30 minutes difference
          discrepancyList.push({
            date,
            type: 'TIME_MISMATCH',
            severity: hoursDiff > 2 ? 'HIGH' : 'MEDIUM',
            description: `Time difference of ${hoursDiff.toFixed(2)} hours between attendance and timesheet`,
            attendanceHours: attendanceRecord.totalHours,
            timesheetHours: timesheetEntry.totalHours,
            suggestedAction: 'Review and reconcile time entries'
          })
        }
        
        // Break time mismatch
        const attendanceBreakTime = attendanceRecord.breaks.reduce((sum, b) => sum + b.duration, 0) / 60
        const timesheetBreakTime = timesheetEntry.breakDuration / 60
        const breakDiff = Math.abs(attendanceBreakTime - timesheetBreakTime)
        
        if (breakDiff > 0.25) { // More than 15 minutes difference
          discrepancyList.push({
            date,
            type: 'BREAK_MISMATCH',
            severity: 'LOW',
            description: `Break time difference of ${(breakDiff * 60).toFixed(0)} minutes`,
            suggestedAction: 'Verify break times in both systems'
          })
        }
      }
    })
    
    setDiscrepancies(discrepancyList.sort((a, b) => {
      const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    }))
  }

  // Sync attendance data to create timesheet entries
  const handleSyncData = async () => {
    try {
      setSyncing(true)
      
      const attendanceToSync = attendanceRecords.filter(record => {
        const hasTimesheet = timesheetEntries.some(entry => entry.date === record.date)
        return !hasTimesheet && record.status === 'PRESENT' && record.totalHours > 0
      })
      
      if (attendanceToSync.length === 0) {
        toast({
          title: 'No Data to Sync',
          description: 'All attendance records already have corresponding timesheet entries'
        })
        return
      }
      
      await onGenerateTimesheet(attendanceToSync)
      await fetchData() // Refresh data
      
      toast({
        title: 'Sync Complete',
        description: `Created ${attendanceToSync.length} timesheet entries from attendance data`
      })
      
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync attendance data',
        variant: 'destructive'
      })
    } finally {
      setSyncing(false)
    }
  }

  // Auto-resolve discrepancies
  const autoResolveDiscrepancies = async () => {
    try {
      const resolvableDiscrepancies = discrepancies.filter(d => 
        d.type === 'MISSING_TIMESHEET' || d.type === 'TIME_MISMATCH'
      )
      
      if (resolvableDiscrepancies.length === 0) {
        toast({
          title: 'No Auto-Resolvable Issues',
          description: 'All discrepancies require manual review'
        })
        return
      }
      
      // This would call an API to auto-resolve discrepancies
      const res = await fetch('/api/timesheets/resolve-discrepancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discrepancies: resolvableDiscrepancies,
          dateRange
        })
      })
      
      if (!res.ok) throw new Error('Failed to resolve discrepancies')
      
      await fetchData() // Refresh data
      
      toast({
        title: 'Discrepancies Resolved',
        description: `Auto-resolved ${resolvableDiscrepancies.length} issues`
      })
      
    } catch (error) {
      toast({
        title: 'Auto-Resolve Failed',
        description: 'Failed to automatically resolve discrepancies',
        variant: 'destructive'
      })
    }
  }

  // Calculate summary statistics
  const summaryStats = {
    totalAttendanceDays: attendanceRecords.filter(r => r.status === 'PRESENT').length,
    totalTimesheetDays: timesheetEntries.length,
    totalDiscrepancies: discrepancies.length,
    highSeverityIssues: discrepancies.filter(d => d.severity === 'HIGH').length,
    syncPercentage: attendanceRecords.length > 0 
      ? Math.round((timesheetEntries.length / attendanceRecords.filter(r => r.status === 'PRESENT').length) * 100)
      : 0
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
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
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Attendance Integration</h2>
          <p className="text-muted-foreground">
            Sync and reconcile attendance with timesheet data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <Sync className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSyncData} disabled={syncing}>
            <Upload className="h-4 w-4 mr-2" />
            {syncing ? 'Syncing...' : 'Sync Data'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Attendance Days</p>
                <p className="text-2xl font-bold">{summaryStats.totalAttendanceDays}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Timesheet Entries</p>
                <p className="text-2xl font-bold">{summaryStats.totalTimesheetDays}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Discrepancies</p>
                <p className="text-2xl font-bold">{summaryStats.totalDiscrepancies}</p>
                {summaryStats.highSeverityIssues > 0 && (
                  <p className="text-xs text-red-600">
                    {summaryStats.highSeverityIssues} high priority
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Sync Rate</p>
                <p className="text-2xl font-bold">{summaryStats.syncPercentage}%</p>
                <Progress value={summaryStats.syncPercentage} className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="discrepancies">
            Discrepancies
            {summaryStats.totalDiscrepancies > 0 && (
              <Badge variant="destructive" className="ml-2">
                {summaryStats.totalDiscrepancies}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="comparison">Data Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-20 flex-col"
                  onClick={handleSyncData}
                  disabled={syncing}
                >
                  <Upload className="h-6 w-6 mb-2" />
                  <span>Sync Missing Entries</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-20 flex-col"
                  onClick={autoResolveDiscrepancies}
                >
                  <CheckCircle className="h-6 w-6 mb-2" />
                  <span>Auto-Resolve Issues</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-20 flex-col"
                  onClick={() => {
                    // Export discrepancy report
                    const csvData = discrepancies.map(d => ({
                      Date: d.date,
                      Type: d.type,
                      Severity: d.severity,
                      Description: d.description,
                      'Suggested Action': d.suggestedAction
                    }))
                    
                    const csv = [
                      Object.keys(csvData[0] || {}).join(','),
                      ...csvData.map(row => Object.values(row).join(','))
                    ].join('\n')
                    
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `attendance-discrepancies-${format(new Date(), 'yyyy-MM-dd')}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <Download className="h-6 w-6 mb-2" />
                  <span>Export Report</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendanceRecords.slice(0, 5).map((record) => {
                  const hasTimesheet = timesheetEntries.some(entry => entry.date === record.date)
                  
                  return (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          record.status === 'PRESENT' ? 'bg-green-500' :
                          record.status === 'LATE' ? 'bg-yellow-500' :
                          record.status === 'ABSENT' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`} />
                        <div>
                          <p className="font-medium">{format(parseISO(record.date), 'MMM dd, yyyy')}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.checkIn && record.checkOut 
                              ? `${record.checkIn} - ${record.checkOut}`
                              : record.status
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{record.totalHours.toFixed(2)}h</span>
                        {hasTimesheet ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discrepancies" className="space-y-4">
          {discrepancies.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Discrepancies Found</h3>
                <p className="text-muted-foreground">
                  All attendance and timesheet data is properly synchronized
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {discrepancies.map((discrepancy, index) => (
                <Alert key={index} className={
                  discrepancy.severity === 'HIGH' ? 'border-red-200 bg-red-50' :
                  discrepancy.severity === 'MEDIUM' ? 'border-yellow-200 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }>
                  <AlertTriangle className={`h-4 w-4 ${
                    discrepancy.severity === 'HIGH' ? 'text-red-600' :
                    discrepancy.severity === 'MEDIUM' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                  <AlertDescription>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {format(parseISO(discrepancy.date), 'MMM dd, yyyy')}
                          </span>
                          <Badge variant={
                            discrepancy.severity === 'HIGH' ? 'destructive' :
                            discrepancy.severity === 'MEDIUM' ? 'default' :
                            'secondary'
                          }>
                            {discrepancy.severity}
                          </Badge>
                        </div>
                        <p className="text-sm mb-2">{discrepancy.description}</p>
                        {(discrepancy.attendanceHours !== undefined || discrepancy.timesheetHours !== undefined) && (
                          <div className="text-xs text-muted-foreground mb-2">
                            {discrepancy.attendanceHours !== undefined && (
                              <span>Attendance: {discrepancy.attendanceHours.toFixed(2)}h</span>
                            )}
                            {discrepancy.attendanceHours !== undefined && discrepancy.timesheetHours !== undefined && (
                              <span> • </span>
                            )}
                            {discrepancy.timesheetHours !== undefined && (
                              <span>Timesheet: {discrepancy.timesheetHours.toFixed(2)}h</span>
                            )}
                          </div>
                        )}
                        <p className="text-xs font-medium text-blue-600">
                          Suggested: {discrepancy.suggestedAction}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        Resolve
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Side-by-Side Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendanceRecords.map((attendance) => {
                  const timesheet = timesheetEntries.find(entry => entry.date === attendance.date)
                  
                  return (
                    <div key={attendance.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                      {/* Attendance Data */}
                      <div>
                        <h4 className="font-medium text-sm text-blue-600 mb-2">Attendance</h4>
                        <div className="space-y-1 text-sm">
                          <p><span className="font-medium">Date:</span> {format(parseISO(attendance.date), 'MMM dd, yyyy')}</p>
                          <p><span className="font-medium">Check In:</span> {attendance.checkIn || 'N/A'}</p>
                          <p><span className="font-medium">Check Out:</span> {attendance.checkOut || 'N/A'}</p>
                          <p><span className="font-medium">Total Hours:</span> {attendance.totalHours.toFixed(2)}h</p>
                          <p><span className="font-medium">Status:</span> {attendance.status}</p>
                        </div>
                      </div>
                      
                      {/* Timesheet Data */}
                      <div>
                        <h4 className="font-medium text-sm text-green-600 mb-2">Timesheet</h4>
                        {timesheet ? (
                          <div className="space-y-1 text-sm">
                            <p><span className="font-medium">Date:</span> {format(parseISO(timesheet.date), 'MMM dd, yyyy')}</p>
                            <p><span className="font-medium">Start Time:</span> {timesheet.startTime}</p>
                            <p><span className="font-medium">End Time:</span> {timesheet.endTime}</p>
                            <p><span className="font-medium">Total Hours:</span> {timesheet.totalHours.toFixed(2)}h</p>
                            <p><span className="font-medium">Status:</span> {timesheet.status}</p>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No timesheet entry found
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

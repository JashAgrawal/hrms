'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Calendar, Clock, MapPin, Filter, Download } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

interface AttendanceRecord {
  id: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  workHours: number | null
  overtime: number | null
  method: string
  location: any
  notes: string | null
  checkInOut: Array<{
    id: string
    type: string
    timestamp: string
    location: any
    isManualEntry: boolean
  }>
}

export function AttendanceHistory() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    status: 'all'
  })

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.status !== 'all') params.append('status', filters.status)
      params.append('limit', '50')

      const response = await fetch(`/api/attendance?${params}`)
      if (response.ok) {
        const data = await response.json()
        setRecords(data.records)
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [filters])

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-'
    return format(new Date(dateString), 'HH:mm:ss')
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy')
  }

  const formatHours = (hours: number | null) => {
    if (!hours) return '-'
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'LATE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'ABSENT':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'HALF_DAY':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'WORK_FROM_HOME':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'ON_LEAVE':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'HOLIDAY':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'WEB':
        return '🌐'
      case 'MOBILE':
        return '📱'
      case 'GPS':
        return '📍'
      case 'BIOMETRIC':
        return '👆'
      default:
        return '❓'
    }
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Check In', 'Check Out', 'Status', 'Work Hours', 'Overtime', 'Method']
    const csvData = records.map(record => [
      formatDate(record.date),
      formatTime(record.checkIn),
      formatTime(record.checkOut),
      record.status,
      formatHours(record.workHours),
      formatHours(record.overtime),
      record.method
    ])

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-history-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="LATE">Late</SelectItem>
                  <SelectItem value="ABSENT">Absent</SelectItem>
                  <SelectItem value="HALF_DAY">Half Day</SelectItem>
                  <SelectItem value="WORK_FROM_HOME">Work From Home</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  <SelectItem value="HOLIDAY">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading attendance records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No attendance records found for the selected period.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Work Hours</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {formatDate(record.date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-green-600" />
                        {formatTime(record.checkIn)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-red-600" />
                        {formatTime(record.checkOut)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(record.status)}>
                        {record.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatHours(record.workHours)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {record.overtime && record.overtime > 0 ? (
                        <span className="text-orange-600 font-medium">
                          {formatHours(record.overtime)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getMethodIcon(record.method)}</span>
                        <span className="text-sm">{record.method}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.location ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Tracked</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {records.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {records.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length}
              </div>
              <p className="text-xs text-muted-foreground">Days Present</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {records.filter(r => r.status === 'LATE').length}
              </div>
              <p className="text-xs text-muted-foreground">Late Days</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {formatHours(records.reduce((sum, r) => sum + (r.workHours || 0), 0))}
              </div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                {formatHours(records.reduce((sum, r) => sum + (r.overtime || 0), 0))}
              </div>
              <p className="text-xs text-muted-foreground">Total Overtime</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
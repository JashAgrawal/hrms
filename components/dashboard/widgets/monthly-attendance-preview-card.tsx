"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Coffee } from "lucide-react"
import { useEffect, useState } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isWeekend } from "date-fns"

interface AttendanceRecord {
  date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY' | 'WEEKEND'
  checkInTime?: string
  checkOutTime?: string
  workingHours?: number
}

interface AttendanceStats {
  totalDays: number
  presentDays: number
  absentDays: number
  lateDays: number
  halfDays: number
  attendanceRate: number
}

export function MonthlyAttendancePreviewCard() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [stats, setStats] = useState<AttendanceStats>({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    halfDays: 0,
    attendanceRate: 0
  })
  const [loading, setLoading] = useState(true)
  const [currentMonth] = useState(new Date())

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        const startDate = startOfMonth(currentMonth)
        const endDate = endOfMonth(currentMonth)
        
        const response = await fetch(
          `/api/attendance?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        )
        
        if (response.ok) {
          const data = await response.json()
          
          // Generate calendar days for the month
          const monthDays = eachDayOfInterval({ start: startDate, end: endDate })
          
          const records: AttendanceRecord[] = monthDays.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd')
            const record = data.records?.find((r: any) => 
              format(new Date(r.date), 'yyyy-MM-dd') === dayStr
            )
            
            if (isWeekend(day)) {
              return {
                date: dayStr,
                status: 'WEEKEND'
              }
            }
            
            if (record) {
              return {
                date: dayStr,
                status: record.status,
                checkInTime: record.checkInTime,
                checkOutTime: record.checkOutTime,
                workingHours: record.workingHours
              }
            }
            
            // Default to absent for past days, no status for future days
            return {
              date: dayStr,
              status: day < new Date() ? 'ABSENT' : 'WEEKEND' // Simplified logic
            }
          })
          
          setAttendanceRecords(records)
          
          // Calculate stats
          const workingDays = records.filter(r => r.status !== 'WEEKEND' && r.status !== 'HOLIDAY')
          const presentDays = records.filter(r => 
            r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY'
          ).length
          const absentDays = records.filter(r => r.status === 'ABSENT').length
          const lateDays = records.filter(r => r.status === 'LATE').length
          const halfDays = records.filter(r => r.status === 'HALF_DAY').length
          
          setStats({
            totalDays: workingDays.length,
            presentDays,
            absentDays,
            lateDays,
            halfDays,
            attendanceRate: workingDays.length > 0 ? (presentDays / workingDays.length) * 100 : 0
          })
        }
      } catch (error) {
        console.error('Failed to fetch attendance data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendanceData()
  }, [currentMonth])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <CheckCircle className="h-3 w-3 text-green-600" />
      case 'ABSENT':
        return <XCircle className="h-3 w-3 text-red-600" />
      case 'LATE':
        return <AlertCircle className="h-3 w-3 text-yellow-600" />
      case 'HALF_DAY':
        return <Clock className="h-3 w-3 text-blue-600" />
      case 'HOLIDAY':
        return <Coffee className="h-3 w-3 text-purple-600" />
      case 'WEEKEND':
        return <div className="h-3 w-3 bg-gray-300 rounded-full" />
      default:
        return <div className="h-3 w-3 bg-gray-200 rounded-full" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-green-100 hover:bg-green-200 border-green-200'
      case 'ABSENT':
        return 'bg-red-100 hover:bg-red-200 border-red-200'
      case 'LATE':
        return 'bg-yellow-100 hover:bg-yellow-200 border-yellow-200'
      case 'HALF_DAY':
        return 'bg-blue-100 hover:bg-blue-200 border-blue-200'
      case 'HOLIDAY':
        return 'bg-purple-100 hover:bg-purple-200 border-purple-200'
      case 'WEEKEND':
        return 'bg-gray-100 hover:bg-gray-200 border-gray-200'
      default:
        return 'bg-gray-50 hover:bg-gray-100 border-gray-100'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Monthly Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Monthly Attendance
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calendar Grid */}
        <div className="space-y-2">
          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground p-1">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start */}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8"></div>
            ))}
            
            {/* Month days */}
            {monthDays.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd')
              const record = attendanceRecords.find(r => r.date === dayStr)
              const status = record?.status || 'ABSENT'
              
              return (
                <div
                  key={dayStr}
                  className={`
                    h-8 rounded border flex items-center justify-center text-xs font-medium
                    transition-colors cursor-pointer
                    ${getStatusColor(status)}
                    ${isToday(day) ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                  `}
                  title={`${format(day, 'MMM dd')} - ${status.replace('_', ' ')}`}
                >
                  <span className="text-xs">{format(day, 'd')}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-600" />
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-yellow-600" />
            <span>Late</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-600" />
            <span>Absent</span>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="pt-3 border-t space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Attendance Rate</span>
            <Badge variant={stats.attendanceRate >= 90 ? "default" : "secondary"}>
              {stats.attendanceRate.toFixed(1)}%
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-green-600">{stats.presentDays}</p>
              <p className="text-xs text-muted-foreground">Present</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-red-600">{stats.absentDays}</p>
              <p className="text-xs text-muted-foreground">Absent</p>
            </div>
          </div>
          
          {stats.lateDays > 0 && (
            <div className="text-center">
              <p className="text-sm text-yellow-600">{stats.lateDays} late arrivals</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, getDay, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, Users, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PunchButton } from '@/components/attendance/punch-button'
import { cn } from '@/lib/utils'

interface AttendanceDay {
  date: string
  dayOfWeek: number
  isWeekend: boolean
  status: 'PP' | 'AB' | 'WO' | 'HD' | 'LV' | null // Present, Absent, Week Off, Half Day, Leave
  leaveType?: string
  isToday: boolean
  isCurrentMonth: boolean
}

interface PendingRequest {
  id: string
  employeeName: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
}

interface CalendarData {
  days: AttendanceDay[]
  pendingRequests: PendingRequest[]
  summary: {
    totalDays: number
    presentDays: number
    absentDays: number
    leaveDays: number
    weekOffs: number
  }
}

export function MobileAttendanceCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('current')

  const fetchCalendarData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        month: format(currentDate, 'yyyy-MM'),
        ...(selectedEmployee !== 'current' && { employeeId: selectedEmployee })
      })

      const response = await fetch(`/api/leave/attendance-calendar?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCalendarData(data)
      } else {
        throw new Error('Failed to fetch calendar data')
      }
    } catch (error) {
      console.error('Error fetching calendar:', error)
      // Fallback to mock data for development
      const mockData = generateMockCalendarData(currentDate)
      setCalendarData(mockData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendarData()
  }, [currentDate, selectedEmployee])

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    )
  }

  const getStatusColor = (status: string | null) => {
    const colors: Record<string, string> = {
      PP: 'bg-green-500 text-white text-xs font-medium', // Present
      AB: 'bg-red-500 text-white text-xs font-medium',   // Absent
      WO: 'bg-blue-400 text-white text-xs font-medium',  // Week Off
      HD: 'bg-yellow-500 text-white text-xs font-medium', // Half Day
      LV: 'bg-purple-500 text-white text-xs font-medium', // Leave
    }
    return colors[status || ''] || ''
  }

  const getStatusText = (status: string | null) => {
    const texts: Record<string, string> = {
      PP: 'PP',
      AB: 'AB', 
      WO: 'WO',
      HD: 'HD',
      LV: 'LV',
    }
    return texts[status || ''] || ''
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading calendar...</p>
        </div>
      </div>
    )
  }

  if (!calendarData) {
    return <div>No data available</div>
  }

  // Group days into weeks
  const weeks: AttendanceDay[][] = []
  for (let i = 0; i < calendarData.days.length; i += 7) {
    weeks.push(calendarData.days.slice(i, i + 7))
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Punch Button */}
      <PunchButton 
        type="out" 
        lastPunchTime="09:30 AM"
        isOnline={true}
      />

      {/* Header with Month Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-lg">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800">
                {format(currentDate, 'MMMM yyyy')}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            {/* Week day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-gray-500 py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar weeks */}
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-1">
                {week.map((day) => {
                  const dayNumber = format(new Date(day.date), 'd')
                  
                  return (
                    <div
                      key={day.date}
                      className={cn(
                        'aspect-square flex flex-col items-center justify-center relative',
                        'border rounded-lg text-sm',
                        day.isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400',
                        day.isToday && 'ring-2 ring-blue-500 bg-blue-50',
                        day.isWeekend && !day.status && 'bg-gray-100'
                      )}
                    >
                      {/* Day number */}
                      <span className={cn(
                        'text-sm font-medium mb-1',
                        day.isToday && 'text-blue-600 font-bold'
                      )}>
                        {dayNumber}
                      </span>
                      
                      {/* Status badge */}
                      {day.status && (
                        <div className={cn(
                          'px-1.5 py-0.5 rounded text-xs font-medium min-w-[20px] text-center',
                          getStatusColor(day.status)
                        )}>
                          {getStatusText(day.status)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Requests Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Pending Requests
          </CardTitle>
          <p className="text-sm text-gray-600">
            Total {calendarData.pendingRequests.length} Pending Requests in this Month
          </p>
        </CardHeader>
        <CardContent>
          {calendarData.pendingRequests.length > 0 ? (
            <div className="space-y-3">
              {calendarData.pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{request.employeeName}</div>
                    <div className="text-xs text-gray-600">
                      {request.leaveType} • {request.days} day{request.days > 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(request.startDate), 'MMM dd')} - {format(new Date(request.endDate), 'MMM dd')}
                    </div>
                  </div>
                  <Badge 
                    variant={request.status === 'PENDING' ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {request.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No pending requests</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Tab (if viewing as manager/HR) */}
      <div className="flex justify-center">
        <div className="bg-teal-500 text-white px-6 py-2 rounded-full text-sm font-medium">
          Employee
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded text-white flex items-center justify-center text-xs font-medium">
                PP
              </div>
              <span>Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded text-white flex items-center justify-center text-xs font-medium">
                AB
              </div>
              <span>Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-400 rounded text-white flex items-center justify-center text-xs font-medium">
                WO
              </div>
              <span>Week Off</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded text-white flex items-center justify-center text-xs font-medium">
                HD
              </div>
              <span>Half Day</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Mock data generator - replace with actual API integration
function generateMockCalendarData(currentDate: Date): CalendarData {
  const startDate = startOfWeek(startOfMonth(currentDate))
  const endDate = endOfWeek(endOfMonth(currentDate))
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const calendarDays: AttendanceDay[] = days.map((date) => {
    const dayOfWeek = getDay(date)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isCurrentMonth = isSameMonth(date, currentDate)
    const dayOfMonth = parseInt(format(date, 'd'))
    
    let status: AttendanceDay['status'] = null
    
    if (isWeekend) {
      status = 'WO'
    } else if (isCurrentMonth) {
      // Mock attendance pattern
      if (dayOfMonth === 25 || dayOfMonth === 26) {
        status = 'AB'
      } else if (dayOfMonth === 27 || dayOfMonth === 28) {
        status = 'AB'
      } else if (dayOfMonth <= 24) {
        status = 'PP'
      }
    }

    return {
      date: date.toISOString(),
      dayOfWeek,
      isWeekend,
      status,
      isToday: isToday(date),
      isCurrentMonth,
    }
  })

  const mockPendingRequests: PendingRequest[] = []

  return {
    days: calendarDays,
    pendingRequests: mockPendingRequests,
    summary: {
      totalDays: 30,
      presentDays: 24,
      absentDays: 4,
      leaveDays: 0,
      weekOffs: 8,
    }
  }
}
'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Users, AlertTriangle, Calendar, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface LeaveCalendarData {
  date: string
  dayOfWeek: number
  isWeekend: boolean
  leaves: Array<{
    id: string
    employee: {
      id: string
      name: string
      code: string
      department: {
        id: string
        name: string
        code: string
      }
    }
    policy: {
      id: string
      name: string
      code: string
      type: string
    }
    startDate: string
    endDate: string
    days: number
    status: string
    reason: string
    isHalfDay: boolean
    halfDayType?: string
  }>
  leaveCount: number
  conflictCount: number
}

interface CalendarSummary {
  totalEmployees: number
  employeesOnLeave: number
  pendingRequests: number
  conflictDays: number
  departments: Array<{
    id: string
    name: string
    code: string
    employeeCount: number
  }>
}

export function LeaveCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarData, setCalendarData] = useState<LeaveCalendarData[]>([])
  const [summary, setSummary] = useState<CalendarSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedDay, setSelectedDay] = useState<LeaveCalendarData | null>(null)
  const [showDayDetails, setShowDayDetails] = useState(false)
  const { toast } = useToast()

  const fetchCalendarData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('month', format(currentDate, 'yyyy-MM'))
      if (selectedDepartment) {
        params.append('departmentId', selectedDepartment)
      }

      const response = await fetch(`/api/leave/calendar?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCalendarData(data.calendar)
        setSummary(data.summary)
      } else {
        throw new Error('Failed to fetch calendar data')
      }
    } catch (error) {
      console.error('Error fetching calendar:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch leave calendar',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendarData()
  }, [currentDate, selectedDepartment])

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    )
  }

  const getLeaveTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ANNUAL: 'bg-blue-500',
      SICK: 'bg-red-500',
      CASUAL: 'bg-green-500',
      MATERNITY: 'bg-pink-500',
      PATERNITY: 'bg-purple-500',
      EMERGENCY: 'bg-orange-500',
      COMPENSATORY: 'bg-yellow-500',
    }
    return colors[type] || 'bg-gray-500'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'border-yellow-400 bg-yellow-50',
      APPROVED: 'border-green-400 bg-green-50',
      REJECTED: 'border-red-400 bg-red-50',
      CANCELLED: 'border-gray-400 bg-gray-50',
    }
    return colors[status] || 'border-gray-400 bg-gray-50'
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Group calendar data by weeks
  const weeks: LeaveCalendarData[][] = []
  for (let i = 0; i < calendarData.length; i += 7) {
    weeks.push(calendarData.slice(i, i + 7))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leave Calendar</h2>
          <p className="text-muted-foreground">
            View team leave schedules and availability
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Departments</SelectItem>
              {summary?.departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name} ({dept.employeeCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">
                Active employees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Leave Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{summary.employeesOnLeave}</div>
              <p className="text-xs text-muted-foreground">
                {summary.totalEmployees > 0 ? 
                  `${((summary.employeesOnLeave / summary.totalEmployees) * 100).toFixed(1)}% of team` : 
                  '0% of team'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.pendingRequests}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conflict Days</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.conflictDays}</div>
              <p className="text-xs text-muted-foreground">
                Multiple leaves
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-xl">
                {format(currentDate, 'MMMM yyyy')}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading calendar...</div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Week day headers */}
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar weeks */}
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 gap-2">
                  {week.map((day) => {
                    const dayDate = new Date(day.date)
                    const isCurrentMonth = isSameMonth(dayDate, currentDate)
                    const isDayToday = isToday(dayDate)

                    return (
                      <div
                        key={day.date}
                        className={cn(
                          'min-h-24 p-2 border rounded-lg cursor-pointer transition-colors',
                          isCurrentMonth ? 'bg-background' : 'bg-muted/30',
                          isDayToday && 'ring-2 ring-primary',
                          day.isWeekend && 'bg-muted/50',
                          day.conflictCount > 0 && 'border-red-300 bg-red-50',
                          'hover:bg-muted/50'
                        )}
                        onClick={() => {
                          if (day.leaves.length > 0) {
                            setSelectedDay(day)
                            setShowDayDetails(true)
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              !isCurrentMonth && 'text-muted-foreground',
                              isDayToday && 'text-primary font-bold'
                            )}
                          >
                            {format(dayDate, 'd')}
                          </span>
                          {day.conflictCount > 0 && (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          )}
                        </div>

                        {/* Leave indicators */}
                        <div className="space-y-1">
                          {day.leaves.slice(0, 3).map((leave, index) => (
                            <div
                              key={`${leave.id}-${index}`}
                              className={cn(
                                'text-xs p-1 rounded border-l-2 truncate',
                                getStatusColor(leave.status)
                              )}
                              style={{
                                borderLeftColor: getLeaveTypeColor(leave.policy.type).replace('bg-', '#')
                              }}
                            >
                              <div className="font-medium truncate">
                                {leave.employee.name}
                              </div>
                              <div className="text-muted-foreground truncate">
                                {leave.policy.code}
                                {leave.isHalfDay && ' (Half)'}
                              </div>
                            </div>
                          ))}
                          {day.leaves.length > 3 && (
                            <div className="text-xs text-muted-foreground text-center">
                              +{day.leaves.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-sm">Annual Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-sm">Sick Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-sm">Casual Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-pink-500 rounded"></div>
              <span className="text-sm">Maternity Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span className="text-sm">Paternity Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-sm">Emergency Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span className="text-sm">Compensatory Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-sm">Conflicts</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Details Dialog */}
      <Dialog open={showDayDetails} onOpenChange={setShowDayDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Leave Details - {selectedDay && format(new Date(selectedDay.date), 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <DayLeaveDetails day={selectedDay} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface DayLeaveDetailsProps {
  day: LeaveCalendarData
}

function DayLeaveDetails({ day }: DayLeaveDetailsProps) {
  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getLeaveTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ANNUAL: 'bg-blue-500',
      SICK: 'bg-red-500',
      CASUAL: 'bg-green-500',
      MATERNITY: 'bg-pink-500',
      PATERNITY: 'bg-purple-500',
      EMERGENCY: 'bg-orange-500',
      COMPENSATORY: 'bg-yellow-500',
    }
    return colors[type] || 'bg-gray-500'
  }

  return (
    <div className="space-y-4">
      {day.conflictCount > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">
              Conflict Alert: {day.conflictCount} employees on leave
            </span>
          </div>
          <p className="text-sm text-red-700 mt-1">
            Multiple team members are scheduled to be on leave on this day. 
            Consider reviewing coverage arrangements.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {day.leaves.map((leave) => (
          <div
            key={leave.id}
            className="p-4 border rounded-lg space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn('w-3 h-3 rounded', getLeaveTypeColor(leave.policy.type))}
                />
                <div>
                  <div className="font-medium">
                    {leave.employee.name} ({leave.employee.code})
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {leave.employee.department.name}
                  </div>
                </div>
              </div>
              <Badge className={getStatusBadgeColor(leave.status)}>
                {leave.status}
              </Badge>
            </div>

            <div className="grid gap-2 md:grid-cols-2 text-sm">
              <div>
                <span className="font-medium">Leave Type:</span> {leave.policy.name}
              </div>
              <div>
                <span className="font-medium">Duration:</span> {leave.days} day{leave.days !== 1 ? 's' : ''}
                {leave.isHalfDay && ` (${leave.halfDayType === 'FIRST_HALF' ? 'First Half' : 'Second Half'})`}
              </div>
              <div>
                <span className="font-medium">Start Date:</span> {format(new Date(leave.startDate), 'MMM dd, yyyy')}
              </div>
              <div>
                <span className="font-medium">End Date:</span> {format(new Date(leave.endDate), 'MMM dd, yyyy')}
              </div>
            </div>

            {leave.reason && (
              <div className="text-sm">
                <span className="font-medium">Reason:</span> {leave.reason}
              </div>
            )}
          </div>
        ))}
      </div>

      {day.leaves.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No leave requests for this day
        </div>
      )}
    </div>
  )
}
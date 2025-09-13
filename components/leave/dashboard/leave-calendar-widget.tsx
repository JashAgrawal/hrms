'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface LeaveEvent {
  id: string
  startDate: string
  endDate: string
  employee: {
    firstName: string
    lastName: string
  }
  policy: {
    name: string
    code: string
  }
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export function LeaveCalendarWidget() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [leaveEvents, setLeaveEvents] = useState<LeaveEvent[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchLeaveEvents()
  }, [currentDate])

  const fetchLeaveEvents = async () => {
    try {
      setLoading(true)
      const startDate = startOfMonth(currentDate)
      const endDate = endOfMonth(currentDate)
      
      const response = await fetch(
        `/api/leave/dashboard/calendar-events?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
      )
      
      if (response.ok) {
        const data = await response.json()
        setLeaveEvents(data.events || [])
      } else {
        throw new Error('Failed to fetch calendar events')
      }
    } catch (error) {
      console.error('Error fetching calendar events:', error)
      toast({
        title: 'Error',
        description: 'Failed to load calendar events',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const getDayEvents = (date: Date) => {
    return leaveEvents.filter(event => {
      const eventStart = new Date(event.startDate)
      const eventEnd = new Date(event.endDate)
      return date >= eventStart && date <= eventEnd
    })
  }

  const getDayEventCount = (date: Date) => {
    return getDayEvents(date).length
  }

  const getEventColor = (status: LeaveEvent['status']) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-500'
      case 'PENDING':
        return 'bg-yellow-500'
      case 'REJECTED':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>Leave Calendar</CardTitle>
          </div>
          <CardDescription>Upcoming team leaves</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-8" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>Leave Calendar</CardTitle>
          </div>
          <Link href="/dashboard/leave/calendar">
            <Button variant="ghost" size="sm">
              Full Calendar
            </Button>
          </Link>
        </div>
        <CardDescription>Upcoming team leaves</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Month Navigation */}
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-2">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center p-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map(day => {
                const dayEvents = getDayEvents(day)
                const eventCount = dayEvents.length
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isTodayDate = isToday(day)

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "relative h-8 w-8 text-xs flex items-center justify-center rounded cursor-pointer hover:bg-muted/50 transition-colors",
                      !isCurrentMonth && "text-muted-foreground opacity-50",
                      isTodayDate && "bg-primary text-primary-foreground font-bold",
                      eventCount > 0 && !isTodayDate && "bg-muted"
                    )}
                    title={
                      eventCount > 0 
                        ? `${eventCount} leave${eventCount > 1 ? 's' : ''} on ${format(day, 'MMM dd')}`
                        : undefined
                    }
                  >
                    {format(day, 'd')}
                    {eventCount > 0 && (
                      <div className="absolute -top-1 -right-1">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          dayEvents.some(e => e.status === 'APPROVED') && "bg-green-500",
                          dayEvents.some(e => e.status === 'PENDING') && !dayEvents.some(e => e.status === 'APPROVED') && "bg-yellow-500"
                        )} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Approved</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Pending</span>
            </div>
          </div>

          {/* Upcoming Events */}
          {leaveEvents.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-sm font-medium">This Month</h4>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {leaveEvents.slice(0, 3).map(event => (
                  <div key={event.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", getEventColor(event.status))} />
                      <span className="font-medium">
                        {event.employee.firstName} {event.employee.lastName}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {format(new Date(event.startDate), 'MMM dd')}
                      {event.startDate !== event.endDate && 
                        ` - ${format(new Date(event.endDate), 'dd')}`
                      }
                    </div>
                  </div>
                ))}
              </div>
              {leaveEvents.length > 3 && (
                <div className="text-center">
                  <Link href="/dashboard/leave/calendar">
                    <Button variant="ghost" size="sm" className="text-xs">
                      View {leaveEvents.length - 3} more
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

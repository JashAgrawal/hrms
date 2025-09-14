"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Users, Clock } from "lucide-react"
import { useEffect, useState } from "react"
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns"

interface Holiday {
  id: string
  name: string
  date: string
  type: 'PUBLIC' | 'COMPANY' | 'OPTIONAL'
}

interface UpcomingLeave {
  id: string
  employeeName: string
  startDate: string
  endDate: string
  type: string
  status: string
}

export function HolidaysUpcomingLeavesCard() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [upcomingLeaves, setUpcomingLeaves] = useState<UpcomingLeave[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch upcoming holidays
        const holidayResponse = await fetch('/api/holidays?upcoming=true&limit=5')
        let holidays: Holiday[] = []

        if (holidayResponse.ok) {
          const holidayData = await holidayResponse.json()
          holidays = holidayData.holidays || []
        } else {
          console.error('Failed to fetch holidays:', holidayResponse.status)
        }

        setHolidays(holidays)

        // Fetch upcoming leaves
        const response = await fetch('/api/leave/requests?status=APPROVED&upcoming=true&limit=5')
        if (response.ok) {
          const data = await response.json()
          const leaves = (data.requests || []).map((request: any) => ({
            id: request.id,
            employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
            startDate: request.startDate,
            endDate: request.endDate,
            type: request.type,
            status: request.status
          }))
          setUpcomingLeaves(leaves)
        }
      } catch (error) {
        console.error('Failed to fetch holidays and leaves:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString)
    
    if (isToday(date)) {
      return 'Today'
    } else if (isTomorrow(date)) {
      return 'Tomorrow'
    } else if (isThisWeek(date)) {
      return format(date, 'EEEE')
    } else {
      return format(date, 'MMM dd')
    }
  }

  const getDateRange = (startDate: string, endDate: string) => {
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return formatDate(startDate)
    }
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }

  const getHolidayBadgeVariant = (type: string) => {
    switch (type) {
      case 'PUBLIC':
        return 'default'
      case 'COMPANY':
        return 'secondary'
      case 'OPTIONAL':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Holidays & Upcoming Leaves
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                  <div className="h-2 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-5 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Holidays & Upcoming Leaves
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Holidays Section */}
        {holidays.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm font-medium">Upcoming Holidays</span>
            </div>
            <div className="space-y-2">
              {holidays.map((holiday) => (
                <div key={holiday.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{holiday.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(holiday.date)}
                    </p>
                  </div>
                  <Badge variant={getHolidayBadgeVariant(holiday.type)} className="text-xs">
                    {holiday.type.toLowerCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Separator */}
        {holidays.length > 0 && upcomingLeaves.length > 0 && (
          <div className="border-t"></div>
        )}

        {/* Upcoming Leaves Section */}
        {upcomingLeaves.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm font-medium">Team Leaves</span>
            </div>
            <div className="space-y-2">
              {upcomingLeaves.map((leave) => (
                <div key={leave.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{leave.employeeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {getDateRange(leave.startDate, leave.endDate)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {leave.type.toLowerCase().replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {holidays.length === 0 && upcomingLeaves.length === 0 && (
          <div className="text-center py-6">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No upcoming holidays or leaves
            </p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="pt-3 border-t">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold">{holidays.length}</p>
              <p className="text-xs text-muted-foreground">Holidays</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{upcomingLeaves.length}</p>
              <p className="text-xs text-muted-foreground">Team Leaves</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
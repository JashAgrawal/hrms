'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Info
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Holiday {
  id: string
  name: string
  date: string
  type: 'PUBLIC' | 'COMPANY' | 'OPTIONAL' | 'RELIGIOUS' | 'NATIONAL'
  description?: string
  isOptional: boolean
  isActive: boolean
  year: number
}

interface OptionalLeavePolicy {
  id: string
  name: string
  year: number
  maxSelectableLeaves: number
  holidays: Array<{
    holiday: Holiday
  }>
}

interface HolidayCalendarProps {
  holidays: Holiday[]
  optionalPolicies: OptionalLeavePolicy[]
  year: number
  onHolidaySelect?: (holiday: Holiday) => void
}

export function HolidayCalendar({ 
  holidays, 
  optionalPolicies, 
  year, 
  onHolidaySelect 
}: HolidayCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date(year, 0, 1))

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getHolidaysForDate = (date: Date) => {
    return holidays.filter(holiday => 
      holiday.isActive && isSameDay(new Date(holiday.date), date)
    )
  }

  const getTypeColor = (type: string) => {
    const colors = {
      PUBLIC: 'bg-blue-500',
      COMPANY: 'bg-green-500',
      OPTIONAL: 'bg-purple-500',
      RELIGIOUS: 'bg-orange-500',
      NATIONAL: 'bg-red-500'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-500'
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    
    // Keep within the selected year
    if (newDate.getFullYear() === year) {
      setCurrentDate(newDate)
    }
  }

  const canNavigatePrev = currentDate.getMonth() > 0
  const canNavigateNext = currentDate.getMonth() < 11

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2" />
                Holiday Calendar
              </CardTitle>
              <CardDescription>
                {format(currentDate, 'MMMM yyyy')} - Company holidays and festivals
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
                disabled={!canNavigatePrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
                disabled={!canNavigateNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {/* Calendar Days */}
            {calendarDays.map(day => {
              const dayHolidays = getHolidaysForDate(day)
              const hasHolidays = dayHolidays.length > 0
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isTodayDate = isToday(day)

              return (
                <TooltipProvider key={day.toISOString()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`
                          relative p-2 min-h-[60px] border rounded-md cursor-pointer transition-colors
                          ${isCurrentMonth ? 'bg-background' : 'bg-muted/30'}
                          ${isTodayDate ? 'ring-2 ring-primary' : ''}
                          ${hasHolidays ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-muted/50'}
                        `}
                        onClick={() => {
                          if (hasHolidays && onHolidaySelect) {
                            onHolidaySelect(dayHolidays[0])
                          }
                        }}
                      >
                        <div className={`text-sm ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {format(day, 'd')}
                        </div>
                        
                        {/* Holiday Indicators */}
                        {hasHolidays && (
                          <div className="mt-1 space-y-1">
                            {dayHolidays.slice(0, 2).map(holiday => (
                              <div
                                key={holiday.id}
                                className={`w-2 h-2 rounded-full ${getTypeColor(holiday.type)}`}
                                title={holiday.name}
                              />
                            ))}
                            {dayHolidays.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{dayHolidays.length - 2}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    {hasHolidays && (
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-2">
                          {dayHolidays.map(holiday => (
                            <div key={holiday.id} className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${getTypeColor(holiday.type)}`} />
                              <div>
                                <div className="font-medium">{holiday.name}</div>
                                {holiday.description && (
                                  <div className="text-xs text-muted-foreground">
                                    {holiday.description}
                                  </div>
                                )}
                                <Badge variant="outline" className="text-xs mt-1">
                                  {holiday.type}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>

          {/* Legend */}
          <div className="border-t pt-4">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Legend:</span>
              </div>
              {['PUBLIC', 'COMPANY', 'OPTIONAL', 'RELIGIOUS', 'NATIONAL'].map(type => (
                <div key={type} className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${getTypeColor(type)}`} />
                  <span className="text-xs">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Holiday Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Holidays This Month</CardTitle>
          <CardDescription>
            {format(currentDate, 'MMMM yyyy')} holiday summary
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const monthHolidays = holidays.filter(holiday => {
              const holidayDate = new Date(holiday.date)
              return holiday.isActive && 
                     holidayDate.getMonth() === currentDate.getMonth() &&
                     holidayDate.getFullYear() === currentDate.getFullYear()
            }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

            if (monthHolidays.length === 0) {
              return (
                <p className="text-muted-foreground">No holidays this month</p>
              )
            }

            return (
              <div className="space-y-3">
                {monthHolidays.map(holiday => (
                  <div key={holiday.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${getTypeColor(holiday.type)}`} />
                      <div>
                        <div className="font-medium">{holiday.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(holiday.date), 'EEEE, MMM dd')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{holiday.type}</Badge>
                      {holiday.isOptional && (
                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}

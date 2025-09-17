"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, Building2, CheckCircle, LogIn, LogOut, Navigation } from "lucide-react"
import { format } from "date-fns"

interface TimelineEvent {
  id: string
  type: 'CHECK_IN' | 'SITE_VISIT_START' | 'SITE_VISIT_END' | 'CHECK_OUT'
  timestamp: string
  location?: {
    name?: string
    address?: string
    latitude?: number
    longitude?: number
  }
  site?: {
    id: string
    name: string
    code: string
  }
  purpose?: string
  method?: string
  duration?: number // For site visits, duration in minutes
}

interface DailyTimelineProps {
  employeeType: 'NORMAL' | 'FIELD_EMPLOYEE'
}

export function DailyTimeline({ employeeType }: DailyTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDailyTimeline()
  }, [])

  const fetchDailyTimeline = async () => {
    try {
      const response = await fetch('/api/attendance/timeline')
      if (response.ok) {
        const data = await response.json()
        setTimeline(data.timeline || [])
      }
    } catch (error) {
      console.error('Error fetching daily timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'CHECK_IN':
        return <LogIn className="h-4 w-4 text-green-600" />
      case 'SITE_VISIT_START':
        return <MapPin className="h-4 w-4 text-blue-600" />
      case 'SITE_VISIT_END':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'CHECK_OUT':
        return <LogOut className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getEventTitle = (event: TimelineEvent) => {
    switch (event.type) {
      case 'CHECK_IN':
        return 'Work Day Started'
      case 'SITE_VISIT_START':
        return `Site Visit: ${event.site?.name || event.location?.name || 'Unknown Location'}`
      case 'SITE_VISIT_END':
        return `Completed Visit: ${event.site?.name || event.location?.name || 'Unknown Location'}`
      case 'CHECK_OUT':
        return 'Work Day Ended'
      default:
        return 'Activity'
    }
  }

  const getEventDescription = (event: TimelineEvent) => {
    switch (event.type) {
      case 'CHECK_IN':
        return `Checked in ${event.method === 'GPS' ? 'with GPS verification' : 'via web'}`
      case 'SITE_VISIT_START':
        return event.purpose ? `Purpose: ${event.purpose}` : 'Site visit started'
      case 'SITE_VISIT_END':
        return event.duration ? `Duration: ${Math.floor(event.duration / 60)}h ${event.duration % 60}m` : 'Site visit completed'
      case 'CHECK_OUT':
        return 'Work day completed'
      default:
        return ''
    }
  }

  const getEventBadge = (event: TimelineEvent) => {
    switch (event.type) {
      case 'CHECK_IN':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            {event.method === 'GPS' ? (
              <>
                <Navigation className="h-3 w-3 mr-1" />
                GPS Verified
              </>
            ) : (
              'Web Check-in'
            )}
          </Badge>
        )
      case 'SITE_VISIT_START':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Started</Badge>
      case 'SITE_VISIT_END':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>
      case 'CHECK_OUT':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Ended</Badge>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-4 animate-pulse">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No activities recorded for today</p>
            <p className="text-sm">Your daily timeline will appear here</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Today's Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {timeline.map((event, index) => (
            <div key={event.id} className="relative">
              {/* Timeline line */}
              {index < timeline.length - 1 && (
                <div className="absolute left-4 top-8 w-0.5 h-6 bg-gray-200"></div>
              )}
              
              <div className="flex items-start gap-4">
                {/* Timeline icon */}
                <div className="flex-shrink-0 w-8 h-8 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center">
                  {getEventIcon(event.type)}
                </div>
                
                {/* Event content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      {getEventTitle(event)}
                    </h4>
                    <div className="flex items-center gap-2">
                      {getEventBadge(event)}
                      <span className="text-xs text-gray-500">
                        {format(new Date(event.timestamp), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {getEventDescription(event)}
                  </p>
                  
                  {/* Site information */}
                  {event.site && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Building2 className="h-3 w-3" />
                      <span>{event.site.code}</span>
                    </div>
                  )}
                  
                  {/* Location information */}
                  {event.location && event.location.address && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      <span>{event.location.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Summary */}
        <div className="mt-6 pt-4 border-t bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Events:</span>
              <span className="ml-2 font-medium">{timeline.length}</span>
            </div>
            {employeeType === 'FIELD_EMPLOYEE' && (
              <div>
                <span className="text-gray-600">Site Visits:</span>
                <span className="ml-2 font-medium">
                  {timeline.filter(e => e.type === 'SITE_VISIT_START').length}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
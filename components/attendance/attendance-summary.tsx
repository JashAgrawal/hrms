"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, Building2, TrendingUp, Calendar } from "lucide-react"
import { format, differenceInHours, differenceInMinutes } from "date-fns"

interface AttendanceSummary {
  checkInTime?: string
  checkOutTime?: string
  totalWorkHours?: number
  totalSiteVisits: number
  activeSiteVisits: number
  status: string
  method?: string
  isComplete: boolean
}

export function AttendanceSummary() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAttendanceSummary()
  }, [])

  const fetchAttendanceSummary = async () => {
    try {
      const response = await fetch('/api/attendance/summary')
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      }
    } catch (error) {
      console.error('Error fetching attendance summary:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
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
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-16"></div>
                <div className="h-6 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-gray-500">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No attendance data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Summary
          </div>
          <Badge className={getStatusColor(summary.status)}>
            {summary.status.replace('_', ' ')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Check In Time */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Clock className="h-3 w-3" />
              <span>Check In</span>
            </div>
            <p className="text-lg font-semibold">
              {summary.checkInTime 
                ? format(new Date(summary.checkInTime), 'HH:mm')
                : '--:--'
              }
            </p>
          </div>

          {/* Check Out Time */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Clock className="h-3 w-3" />
              <span>Check Out</span>
            </div>
            <p className="text-lg font-semibold">
              {summary.checkOutTime 
                ? format(new Date(summary.checkOutTime), 'HH:mm')
                : summary.checkInTime ? 'In Progress' : '--:--'
              }
            </p>
          </div>

          {/* Work Hours */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <TrendingUp className="h-3 w-3" />
              <span>Work Hours</span>
            </div>
            <p className="text-lg font-semibold">
              {summary.totalWorkHours 
                ? formatDuration(summary.totalWorkHours)
                : summary.checkInTime && !summary.checkOutTime
                  ? formatDuration(differenceInMinutes(new Date(), new Date(summary.checkInTime)) / 60)
                  : '0h 0m'
              }
            </p>
          </div>

          {/* Site Visits */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Building2 className="h-3 w-3" />
              <span>Site Visits</span>
            </div>
            <p className="text-lg font-semibold">
              {summary.totalSiteVisits}
              {summary.activeSiteVisits > 0 && (
                <span className="text-sm text-blue-600 ml-1">
                  ({summary.activeSiteVisits} active)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Day Progress</span>
            <span className="font-medium">
              {summary.isComplete ? 'Completed' : 'In Progress'}
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                summary.isComplete ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ 
                width: summary.isComplete ? '100%' : 
                       summary.checkInTime ? '50%' : '0%' 
              }}
            ></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
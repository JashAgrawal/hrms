"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, Coffee, LogOut, LogIn, AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { format } from "date-fns"

interface AttendanceStatus {
  isCheckedIn: boolean
  hasCheckedIn?: boolean
  hasCheckedOut?: boolean
  checkInTime?: string
  checkOutTime?: string
  workingHours: string
  breakTime: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_BREAK' | 'NOT_MARKED'
  location?: {
    name: string
    isValid: boolean
  }
}

export function CheckInOutCard() {
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
    isCheckedIn: false,
    workingHours: '0h 0m',
    breakTime: '0m',
    status: 'ABSENT'
  })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, []) // This is intentionally empty as we want this to run once on mount

  useEffect(() => {
    const fetchAttendanceStatus = async () => {
      try {
        const response = await fetch('/api/attendance/status')
        if (response.ok) {
          const data = await response.json()
          // Map API response to component state
          setAttendanceStatus({
            isCheckedIn: data.hasCheckedIn && !data.hasCheckedOut,
            hasCheckedIn: data.hasCheckedIn,
            hasCheckedOut: data.hasCheckedOut,
            checkInTime: data.checkInTime,
            checkOutTime: data.checkOutTime,
            workingHours: data.currentWorkHours ? `${Math.floor(data.currentWorkHours)}h ${Math.round((data.currentWorkHours % 1) * 60)}m` : '0h 0m',
            breakTime: '0m', // TODO: Implement break time tracking
            status: data.status === 'NOT_MARKED' ? 'ABSENT' : data.status,
            location: data.location ? {
              name: data.location.address || 'Unknown Location',
              isValid: true
            } : undefined
          })
        }
      } catch (error) {
        console.error('Failed to fetch attendance status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendanceStatus()
  }, [])

  const handleCheckIn = async () => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          location: await getCurrentLocation()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setAttendanceStatus(prev => ({
          ...prev,
          isCheckedIn: true,
          checkInTime: data.checkInTime,
          status: 'PRESENT'
        }))
      }
    } catch (error) {
      console.error('Check-in failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async () => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          location: await getCurrentLocation()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setAttendanceStatus(prev => ({
          ...prev,
          isCheckedIn: false,
          checkOutTime: data.checkOutTime,
          workingHours: data.workingHours,
          status: 'ABSENT'
        }))
      }
    } catch (error) {
      console.error('Check-out failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleBreak = async () => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/attendance/break', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        setAttendanceStatus(prev => ({
          ...prev,
          status: prev.status === 'ON_BREAK' ? 'PRESENT' : 'ON_BREAK'
        }))
      }
    } catch (error) {
      console.error('Break toggle failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const getCurrentLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        },
        () => resolve(null),
        { timeout: 10000 }
      )
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <Badge variant="default" className="bg-green-100 text-green-800">Present</Badge>
      case 'LATE':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Late</Badge>
      case 'ON_BREAK':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">On Break</Badge>
      case 'NOT_MARKED':
      case 'ABSENT':
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Not Checked In</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Check In/Out
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-200 rounded w-24"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          Check In/Out
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Status</span>
          {getStatusBadge(attendanceStatus.status)}
        </div>

        {/* Current Time */}
        <div className="text-center py-3 bg-muted/30 rounded-lg">
          <p className="text-3xl md:text-2xl font-bold text-foreground" aria-label={`Current time is ${format(currentTime, 'HH:mm')}`}>
            {format(currentTime, 'HH:mm')}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {format(currentTime, 'EEEE, MMM dd')}
          </p>
        </div>

        {/* Time Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <LogIn className="h-3 w-3 text-green-600" />
              <span className="text-xs text-muted-foreground">Check In</span>
            </div>
            <p className="text-sm font-medium">
              {attendanceStatus.checkInTime 
                ? format(new Date(attendanceStatus.checkInTime), 'HH:mm')
                : '--:--'
              }
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <LogOut className="h-3 w-3 text-red-600" />
              <span className="text-xs text-muted-foreground">Check Out</span>
            </div>
            <p className="text-sm font-medium">
              {attendanceStatus.checkOutTime 
                ? format(new Date(attendanceStatus.checkOutTime), 'HH:mm')
                : '--:--'
              }
            </p>
          </div>
        </div>

        {/* Working Hours */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Working Time</span>
            <span className="text-sm font-medium">{attendanceStatus.workingHours}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Break Time</span>
            <span className="text-sm font-medium">{attendanceStatus.breakTime}</span>
          </div>
        </div>

        {/* Location Status */}
        {attendanceStatus.location && (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {attendanceStatus.location.name}
            </span>
            {!attendanceStatus.location.isValid && (
              <AlertCircle className="h-3 w-3 text-yellow-600" />
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {!attendanceStatus.isCheckedIn ? (
            <Button
              onClick={handleCheckIn}
              disabled={actionLoading}
              className="w-full h-12 text-base font-medium"
              size="lg"
              aria-label="Check in to work"
            >
              <LogIn className="h-4 w-4 mr-2" />
              {actionLoading ? 'Checking In...' : 'Check In'}
            </Button>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleCheckOut}
                disabled={actionLoading}
                variant="outline"
                className="w-full h-12 text-base font-medium"
                size="lg"
                aria-label="Check out from work"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {actionLoading ? 'Checking Out...' : 'Check Out'}
              </Button>
              <Button
                onClick={handleBreak}
                disabled={actionLoading}
                variant="secondary"
                className="w-full h-10 text-sm font-medium"
                size="default"
                aria-label={attendanceStatus.status === 'ON_BREAK' ? 'Resume work from break' : 'Take a break'}
              >
                <Coffee className="h-4 w-4 mr-2" />
                {attendanceStatus.status === 'ON_BREAK'
                  ? (actionLoading ? 'Resuming...' : 'Resume Work')
                  : (actionLoading ? 'Taking Break...' : 'Take Break')
                }
              </Button>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="pt-3 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Standard hours: 8h 0m • Overtime: 0h 0m
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
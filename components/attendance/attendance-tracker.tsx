'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, MapPin, Timer, AlertCircle, Smartphone, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { GPSAttendanceTracker } from './gps-attendance-tracker'

interface AttendanceStatus {
  hasCheckedIn: boolean
  hasCheckedOut: boolean
  checkInTime: string | null
  checkOutTime: string | null
  status: string
  workHours: number
  overtime: number
  currentWorkHours: number
  location: any
  method: string
}

export function AttendanceTracker() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Fetch attendance status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/attendance/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      } else {
        toast.error('Failed to fetch attendance status')
      }
    } catch (error) {
      console.error('Error fetching status:', error)
      toast.error('Failed to fetch attendance status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleCheckIn = async () => {
    setActionLoading(true)
    try {
      // Get location if available
      let location = undefined
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            })
          })
          
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        } catch (error) {
          console.log('Location not available:', error)
        }
      }

      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
          method: 'WEB'
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        await fetchStatus()
      } else {
        toast.error(data.error || 'Failed to check in')
      }
    } catch (error) {
      console.error('Error checking in:', error)
      toast.error('Failed to check in')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async () => {
    setActionLoading(true)
    try {
      // Get location if available
      let location = undefined
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            })
          })
          
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        } catch (error) {
          console.log('Location not available:', error)
        }
      }

      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
          method: 'WEB'
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        await fetchStatus()
      } else {
        toast.error(data.error || 'Failed to check out')
      }
    } catch (error) {
      console.error('Error checking out:', error)
      toast.error('Failed to check out')
    } finally {
      setActionLoading(false)
    }
  }

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatHours = (hours: number) => {
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
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="flex gap-4">
          <div className="h-10 w-24 bg-muted animate-pulse rounded" />
          <div className="h-10 w-24 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Time Display */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-900 mb-2">
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
            <div className="text-sm text-blue-700">
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Method Tabs */}
      <Tabs defaultValue="web" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="web" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Web Check-in
          </TabsTrigger>
          <TabsTrigger value="gps" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            GPS Check-in
          </TabsTrigger>
        </TabsList>

        <TabsContent value="web" className="space-y-6 mt-6">
          {/* Web-based attendance content */}
          {renderWebAttendance()}
        </TabsContent>

        <TabsContent value="gps" className="space-y-6 mt-6">
          {/* GPS-based attendance content */}
          <GPSAttendanceTracker />
        </TabsContent>
      </Tabs>
    </div>
  )

  function renderWebAttendance() {
    return (
      <>
        {/* Attendance Status */}
        {status && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Today's Status</h3>
                  <Badge className={getStatusColor(status.status)}>
                    {status.status.replace('_', ' ')}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {status.checkInTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span>Check In: {formatTime(status.checkInTime)}</span>
                    </div>
                  )}
                  
                  {status.checkOutTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-red-600" />
                      <span>Check Out: {formatTime(status.checkOutTime)}</span>
                    </div>
                  )}
                  
                  {status.hasCheckedIn && !status.hasCheckedOut && (
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4 text-blue-600" />
                      <span>Working: {formatHours(status.currentWorkHours)}</span>
                    </div>
                  )}
                  
                  {status.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-gray-600" />
                      <span>Location tracked</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Work Hours</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Hours</span>
                    <span className="font-medium">
                      {status.hasCheckedOut 
                        ? formatHours(status.workHours) 
                        : formatHours(status.currentWorkHours)
                      }
                    </span>
                  </div>
                  
                  {status.overtime > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Overtime</span>
                      <span className="font-medium text-orange-600">
                        {formatHours(status.overtime)}
                      </span>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Standard</span>
                    <span className="text-sm">8h 0m</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          {!status?.hasCheckedIn ? (
            <Button
              onClick={handleCheckIn}
              disabled={actionLoading}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8"
            >
              <Clock className="h-4 w-4 mr-2" />
              {actionLoading ? 'Checking In...' : 'Check In'}
            </Button>
          ) : !status?.hasCheckedOut ? (
            <Button
              onClick={handleCheckOut}
              disabled={actionLoading}
              size="lg"
              variant="destructive"
              className="px-8"
            >
              <Clock className="h-4 w-4 mr-2" />
              {actionLoading ? 'Checking Out...' : 'Check Out'}
            </Button>
          ) : (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                <Clock className="h-5 w-5" />
                <span className="font-medium">Attendance marked for today</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Total work hours: {formatHours(status.workHours)}
              </p>
            </div>
          )}
        </div>

        {/* Info Message */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Web Attendance Guidelines</p>
                <ul className="text-xs space-y-1 text-blue-700">
                  <li>• Standard work hours: 9:00 AM - 6:00 PM (8 hours)</li>
                  <li>• Grace period: 15 minutes after 9:00 AM</li>
                  <li>• Use web check-in when working from office</li>
                  <li>• Contact HR for any attendance corrections</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }
}
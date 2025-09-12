'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, MapPin, Timer, AlertCircle, Smartphone, Monitor, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { LocationValidationStatus } from './location-validation-status'

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
  locationValidation?: {
    isValid: boolean
    nearestLocation?: {
      name: string
      distance: number
    }
    requiresApproval: boolean
  }
}

interface LocationStatus {
  isValid: boolean
  currentLocation: {
    latitude: number
    longitude: number
    accuracy?: number
  }
  assignedLocations: any[]
  validation: any
}

export function EnhancedAttendanceTracker() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [locationStatus, setLocationStatus] = useState<LocationStatus | null>(null)

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

  const handleWebCheckIn = async () => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'WEB',
          notes: 'Web check-in'
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Successfully checked in')
        await fetchStatus()
      } else {
        toast.error(data.error || 'Failed to check in')
      }
    } catch (error) {
      toast.error('Failed to check in')
    } finally {
      setActionLoading(false)
    }
  }

  const handleWebCheckOut = async () => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'WEB',
          notes: 'Web check-out'
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Successfully checked out')
        await fetchStatus()
      } else {
        toast.error(data.error || 'Failed to check out')
      }
    } catch (error) {
      toast.error('Failed to check out')
    } finally {
      setActionLoading(false)
    }
  }

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present': return 'bg-green-100 text-green-800'
      case 'late': return 'bg-yellow-100 text-yellow-800'
      case 'absent': return 'bg-red-100 text-red-800'
      case 'half_day': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleLocationChange = (newLocationStatus: LocationStatus) => {
    setLocationStatus(newLocationStatus)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading attendance data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Time and Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>

          {status && (
            <>
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Check In</div>
                  <div className="font-medium">
                    {status.checkInTime ? formatTime(status.checkInTime) : '-'}
                  </div>
                  {status.method && status.checkInTime && (
                    <Badge variant="outline" className="mt-1">
                      {status.method}
                    </Badge>
                  )}
                </div>
                
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Check Out</div>
                  <div className="font-medium">
                    {status.checkOutTime ? formatTime(status.checkOutTime) : '-'}
                  </div>
                </div>
              </div>

              <div className="text-center">
                <Badge className={getStatusColor(status.status)}>
                  {status.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              {status.hasCheckedIn && !status.hasCheckedOut && (
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Current Work Hours</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatHours(status.currentWorkHours)}
                  </div>
                </div>
              )}

              {status.hasCheckedOut && (
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Work Hours</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatHours(status.workHours)}
                  </div>
                  {status.overtime > 0 && (
                    <div className="text-sm text-orange-600">
                      Overtime: {formatHours(status.overtime)}
                    </div>
                  )}
                </div>
              )}

              {/* Location Validation Status */}
              {status.locationValidation && (
                <Alert className={status.locationValidation.isValid ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
                  <div className="flex items-center gap-2">
                    {status.locationValidation.isValid ? 
                      <CheckCircle className="h-4 w-4 text-green-600" /> : 
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    }
                    <AlertDescription className={status.locationValidation.isValid ? 'text-green-800' : 'text-yellow-800'}>
                      {status.locationValidation.isValid ? 
                        'Location verified - within assigned work area' :
                        status.locationValidation.requiresApproval ?
                          'Location requires approval - outside assigned work areas' :
                          'Location validation pending'
                      }
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Attendance Actions */}
      <Tabs defaultValue="gps" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gps" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            GPS Attendance
          </TabsTrigger>
          <TabsTrigger value="web" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Web Attendance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gps" className="space-y-4">
          <LocationValidationStatus 
            onLocationChange={handleLocationChange}
            showRefresh={true}
          />
        </TabsContent>

        <TabsContent value="web" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Web-based Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Web-based attendance does not validate your location. Use GPS attendance for location-based check-in/out.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {!status?.hasCheckedIn ? (
                  <Button
                    onClick={handleWebCheckIn}
                    disabled={actionLoading}
                    size="lg"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    {actionLoading ? 'Checking In...' : 'Web Check In'}
                  </Button>
                ) : !status?.hasCheckedOut ? (
                  <Button
                    onClick={handleWebCheckOut}
                    disabled={actionLoading}
                    size="lg"
                    variant="destructive"
                    className="w-full"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    {actionLoading ? 'Checking Out...' : 'Web Check Out'}
                  </Button>
                ) : (
                  <div className="text-center py-4">
                    <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Attendance completed for today</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total work hours: {formatHours(status.workHours)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Location Status Details */}
      {locationStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Assigned Locations</div>
                  <div className="font-medium">{locationStatus.assignedLocations.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Location Status</div>
                  <Badge variant={locationStatus.isValid ? 'default' : 'destructive'}>
                    {locationStatus.isValid ? 'Valid' : 'Invalid'}
                  </Badge>
                </div>
              </div>

              {locationStatus.validation.nearestLocation && (
                <div>
                  <div className="text-sm text-muted-foreground">Nearest Location</div>
                  <div className="font-medium">
                    {locationStatus.validation.nearestLocation.name} 
                    <span className="text-sm text-muted-foreground ml-2">
                      ({locationStatus.validation.nearestLocation.distance}m away)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
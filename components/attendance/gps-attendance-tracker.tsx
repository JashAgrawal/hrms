'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { MapPin, Clock, Smartphone, Wifi, WifiOff, AlertTriangle, CheckCircle, Route } from 'lucide-react'
import { toast } from 'sonner'

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  address?: string
}

interface LocationValidation {
  isWithinGeofence: boolean
  nearestLocation: {
    name: string
    distance: number
  } | null
  requiresApproval: boolean
}

interface GPSAttendanceStatus {
  hasCheckedIn: boolean
  hasCheckedOut: boolean
  checkInTime: string | null
  checkOutTime: string | null
  status: string
  workHours: number
  currentWorkHours: number
  locationValidation?: LocationValidation
}

export function GPSAttendanceTracker() {
  const [status, setStatus] = useState<GPSAttendanceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Get current location
  const getCurrentLocation = async (): Promise<LocationData> => {
    setLocationLoading(true)
    setLocationError(null)

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser')
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
          }
        )
      })

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }

      // Try to get address using reverse geocoding (optional)
      try {
        const response = await fetch(
          `https://api.opencagedata.com/geocode/v1/json?q=${locationData.latitude}+${locationData.longitude}&key=YOUR_API_KEY`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.results && data.results[0]) {
            locationData.address = data.results[0].formatted
          }
        }
      } catch (error) {
        // Ignore geocoding errors
        console.log('Geocoding not available:', error)
      }

      setCurrentLocation(locationData)
      return locationData

    } catch (error: any) {
      let errorMessage = 'Failed to get location'
      
      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location permissions.'
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please check your GPS settings.'
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.'
      }

      setLocationError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLocationLoading(false)
    }
  }

  // Fetch attendance status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/attendance/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('Error fetching status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleGPSCheckIn = async () => {
    if (!isOnline) {
      toast.error('No internet connection. Please connect to the internet to check in.')
      return
    }

    setActionLoading(true)
    try {
      const location = await getCurrentLocation()

      const response = await fetch('/api/attendance/gps-check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
          deviceInfo: {
            platform: 'mobile',
            userAgent: navigator.userAgent,
            deviceId: 'web-' + Date.now(),
            appVersion: '1.0.0'
          }
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Track distance for this check-in
        try {
          await fetch('/api/distance-tracking', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              location: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
              },
            }),
          })
        } catch (distanceError) {
          console.warn('Failed to track distance:', distanceError)
          // Don't fail the check-in if distance tracking fails
        }

        toast.success(data.message)
        await fetchStatus()
      } else {
        toast.error(data.error || 'Failed to check in')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGPSCheckOut = async () => {
    if (!isOnline) {
      toast.error('No internet connection. Please connect to the internet to check out.')
      return
    }

    setActionLoading(true)
    try {
      const location = await getCurrentLocation()

      const response = await fetch('/api/attendance/gps-check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
          deviceInfo: {
            platform: 'mobile',
            userAgent: navigator.userAgent,
            deviceId: 'web-' + Date.now(),
            appVersion: '1.0.0'
          }
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        await fetchStatus()
      } else {
        toast.error(data.error || 'Failed to check out')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check out')
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

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy <= 10) return 'text-green-600'
    if (accuracy <= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAccuracyText = (accuracy: number) => {
    if (accuracy <= 10) return 'High'
    if (accuracy <= 50) return 'Medium'
    return 'Low'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading GPS attendance...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Alert className={isOnline ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        <div className="flex items-center gap-2">
          {isOnline ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-red-600" />}
          <AlertDescription className={isOnline ? 'text-green-800' : 'text-red-800'}>
            {isOnline ? 'Connected - GPS attendance available' : 'Offline - GPS attendance unavailable'}
          </AlertDescription>
        </div>
      </Alert>

      {/* Location Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentLocation ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">GPS Accuracy</span>
                <Badge className={getAccuracyColor(currentLocation.accuracy)}>
                  {getAccuracyText(currentLocation.accuracy)} ({Math.round(currentLocation.accuracy)}m)
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Coordinates</span>
                <span className="text-sm font-mono">
                  {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                </span>
              </div>

              {currentLocation.address && (
                <div className="text-sm text-muted-foreground">
                  <strong>Address:</strong> {currentLocation.address}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <Button
                onClick={getCurrentLocation}
                disabled={locationLoading || !isOnline}
                variant="outline"
                className="flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                {locationLoading ? 'Getting Location...' : 'Get Current Location'}
              </Button>
              
              {locationError && (
                <Alert className="mt-4 border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {locationError}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Status */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today's Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Check In</div>
                <div className="font-medium">
                  {status.checkInTime ? formatTime(status.checkInTime) : '-'}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">Check Out</div>
                <div className="font-medium">
                  {status.checkOutTime ? formatTime(status.checkOutTime) : '-'}
                </div>
              </div>
            </div>

            {status.hasCheckedIn && !status.hasCheckedOut && (
              <div>
                <div className="text-sm text-muted-foreground">Current Work Hours</div>
                <div className="text-lg font-bold text-blue-600">
                  {formatHours(status.currentWorkHours)}
                </div>
              </div>
            )}

            {status.locationValidation && (
              <Alert className={status.locationValidation.isWithinGeofence ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
                <div className="flex items-center gap-2">
                  {status.locationValidation.isWithinGeofence ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  }
                  <AlertDescription className={status.locationValidation.isWithinGeofence ? 'text-green-800' : 'text-yellow-800'}>
                    {status.locationValidation.isWithinGeofence ? 
                      'Location verified - within office premises' :
                      `Location pending verification - ${status.locationValidation.nearestLocation?.distance}m from ${status.locationValidation.nearestLocation?.name}`
                    }
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-4">
        {!status?.hasCheckedIn ? (
          <Button
            onClick={handleGPSCheckIn}
            disabled={actionLoading || locationLoading || !isOnline}
            size="lg"
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            {actionLoading ? 'Checking In...' : 'GPS Check In'}
          </Button>
        ) : !status?.hasCheckedOut ? (
          <Button
            onClick={handleGPSCheckOut}
            disabled={actionLoading || locationLoading || !isOnline}
            size="lg"
            variant="destructive"
            className="w-full"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            {actionLoading ? 'Checking Out...' : 'GPS Check Out'}
          </Button>
        ) : (
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">GPS attendance completed for today</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Total work hours: {formatHours(status.workHours)}
            </p>
          </div>
        )}

        {locationLoading && (
          <div className="text-center">
            <Progress value={undefined} className="w-full mb-2" />
            <p className="text-sm text-muted-foreground">Getting your location...</p>
          </div>
        )}
      </div>

      {/* GPS Guidelines */}
      <Alert>
        <MapPin className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-1">
            <p className="font-medium">GPS Attendance Guidelines:</p>
            <ul className="text-xs space-y-1 ml-4 list-disc">
              <li>Ensure location services are enabled</li>
              <li>Use GPS check-in when working from office or field</li>
              <li>High GPS accuracy (≤10m) is recommended</li>
              <li>Location verification may be required for remote check-ins</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
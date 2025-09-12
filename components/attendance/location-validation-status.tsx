'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { MapPin, Navigation, CheckCircle, AlertTriangle, RefreshCw, Building2 } from 'lucide-react'
import { toast } from 'sonner'

interface GPSCoordinates {
  latitude: number
  longitude: number
  accuracy?: number
}

interface LocationValidation {
  isValid: boolean
  nearestLocation?: {
    id: string
    name: string
    distance: number
  }
  requiresApproval: boolean
  validLocations: Array<{
    id: string
    name: string
    distance: number
    isWithinRadius: boolean
  }>
}

interface EmployeeLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  radius: number
  isOfficeLocation: boolean
}

interface LocationStatus {
  isValid: boolean
  currentLocation: GPSCoordinates
  assignedLocations: EmployeeLocation[]
  validation: LocationValidation
}

interface LocationValidationStatusProps {
  employeeId?: string
  showRefresh?: boolean
  onLocationChange?: (status: LocationStatus) => void
}

export function LocationValidationStatus({ 
  employeeId, 
  showRefresh = true, 
  onLocationChange 
}: LocationValidationStatusProps) {
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationStatus, setLocationStatus] = useState<LocationStatus | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  useEffect(() => {
    if (employeeId) {
      getCurrentLocationAndValidate()
    }
  }, [employeeId])

  const getCurrentLocation = async (): Promise<GPSCoordinates> => {
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

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }

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

  const validateLocation = async (currentLocation: GPSCoordinates): Promise<LocationStatus> => {
    if (!employeeId) {
      throw new Error('Employee ID is required')
    }

    const response = await fetch('/api/attendance/validate-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId,
        currentLocation
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to validate location')
    }

    return response.json()
  }

  const getCurrentLocationAndValidate = async () => {
    if (!employeeId) return

    setLoading(true)
    try {
      const currentLocation = await getCurrentLocation()
      const status = await validateLocation(currentLocation)
      
      setLocationStatus(status)
      onLocationChange?.(status)
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to validate location')
    } finally {
      setLoading(false)
    }
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

  const formatDistance = (distance: number) => {
    if (distance < 1000) {
      return `${Math.round(distance)}m`
    }
    return `${(distance / 1000).toFixed(1)}km`
  }

  if (loading && !locationStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Validating location...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Status
          </CardTitle>
          {showRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={getCurrentLocationAndValidate}
              disabled={loading || locationLoading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {locationError && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {locationError}
            </AlertDescription>
          </Alert>
        )}

        {locationLoading && (
          <div className="text-center py-4">
            <Progress value={undefined} className="w-full mb-2" />
            <p className="text-sm text-muted-foreground">Getting your location...</p>
          </div>
        )}

        {locationStatus && (
          <>
            {/* Current Location Info */}
            <div className="space-y-2">
              <h3 className="font-medium">Current Location</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">GPS Accuracy</span>
                  {locationStatus.currentLocation.accuracy && (
                    <Badge className={getAccuracyColor(locationStatus.currentLocation.accuracy)}>
                      {getAccuracyText(locationStatus.currentLocation.accuracy)} ({Math.round(locationStatus.currentLocation.accuracy)}m)
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Coordinates</span>
                  <span className="text-sm font-mono">
                    {locationStatus.currentLocation.latitude.toFixed(6)}, {locationStatus.currentLocation.longitude.toFixed(6)}
                  </span>
                </div>
              </div>
            </div>

            {/* Validation Status */}
            <Alert className={locationStatus.validation.isValid ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
              <div className="flex items-center gap-2">
                {locationStatus.validation.isValid ? 
                  <CheckCircle className="h-4 w-4 text-green-600" /> : 
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                }
                <AlertDescription className={locationStatus.validation.isValid ? 'text-green-800' : 'text-yellow-800'}>
                  {locationStatus.validation.isValid ? 
                    'Location verified - within assigned work area' :
                    locationStatus.validation.requiresApproval ?
                      'Location requires approval - outside assigned work areas' :
                      'Location validation pending'
                  }
                </AlertDescription>
              </div>
            </Alert>

            {/* Nearest Location */}
            {locationStatus.validation.nearestLocation && (
              <div className="space-y-2">
                <h3 className="font-medium">Nearest Assigned Location</h3>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{locationStatus.validation.nearestLocation.name}</span>
                  </div>
                  <Badge variant="outline">
                    {formatDistance(locationStatus.validation.nearestLocation.distance)} away
                  </Badge>
                </div>
              </div>
            )}

            {/* All Assigned Locations */}
            {locationStatus.assignedLocations.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Assigned Locations ({locationStatus.assignedLocations.length})</h3>
                <div className="space-y-2">
                  {locationStatus.validation.validLocations.map((location) => (
                    <div key={location.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        {location.isWithinRadius ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <MapPin className="h-4 w-4 text-gray-400" />
                        )}
                        <span className={location.isWithinRadius ? 'font-medium text-green-700' : 'text-muted-foreground'}>
                          {location.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={location.isWithinRadius ? 'default' : 'outline'}
                          className={location.isWithinRadius ? 'bg-green-100 text-green-800' : ''}
                        >
                          {formatDistance(location.distance)}
                        </Badge>
                        {location.isWithinRadius && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            In Range
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Locations Assigned */}
            {locationStatus.assignedLocations.length === 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  No locations assigned. Contact HR to assign work locations for attendance check-in.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Guidelines */}
        <Alert>
          <Navigation className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Location Validation Guidelines:</p>
              <ul className="text-xs space-y-1 ml-4 list-disc">
                <li>High GPS accuracy (≤10m) is recommended for precise validation</li>
                <li>You must be within the assigned location radius to check in</li>
                <li>Out-of-location check-ins require manager approval</li>
                <li>Enable location services for accurate positioning</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
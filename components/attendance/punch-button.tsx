'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, MapPin, Wifi, WifiOff } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { AttendanceRequestDialog } from './attendance-request-dialog'
import { cn } from '@/lib/utils'

interface PunchButtonProps {
  type: 'in' | 'out'
  lastPunchTime?: string
  isOnline?: boolean
  location?: {
    latitude: number
    longitude: number
    accuracy: number
  }
}

export function PunchButton({ 
  type, 
  lastPunchTime, 
  isOnline = true,
  location 
}: PunchButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showRequestDialog, setShowRequestDialog] = useState(false)
  const [locationError, setLocationError] = useState<{
    location: { latitude: number; longitude: number; accuracy?: number }
    nearestLocation?: any
  } | null>(null)
  const { toast } = useToast()

  const handlePunch = async () => {
    try {
      setLoading(true)
      
      // Get current location if not provided
      let currentLocation = location
      if (!currentLocation) {
        try {
          const position = await getCurrentPosition()
          currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        } catch (error) {
          console.warn('Could not get location:', error)
        }
      }

      const response = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: type.toUpperCase(),
          location: currentLocation,
          timestamp: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: `Punch ${type === 'in' ? 'In' : 'Out'} Successful`,
          description: `Recorded at ${new Date().toLocaleTimeString()}`,
        })
      } else {
        const error = await response.json()
        
        // Handle geo-fencing error
        if (error.error === 'LOCATION_NOT_ALLOWED' && error.details?.canRequestApproval) {
          setLocationError({
            location: currentLocation!,
            nearestLocation: error.details.nearestLocation
          })
          setShowRequestDialog(true)
          return
        }
        
        throw new Error(error.error || 'Failed to record punch')
      }
    } catch (error) {
      console.error('Punch error:', error)
      toast({
        title: 'Error',
        description: 'Failed to record punch. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      )
    })
  }

  return (
    <>
      <div className="space-y-4">
        {/* Status indicators */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          
          {location && (
            <div className="flex items-center gap-1 text-gray-500">
              <MapPin className="h-3 w-3" />
              <span className="text-xs">Location detected</span>
            </div>
          )}
        </div>

        {/* Punch button */}
        <Card>
          <CardContent className="p-0">
            <Button
              onClick={handlePunch}
              disabled={loading}
              className={cn(
                'w-full h-16 text-lg font-semibold rounded-lg',
                type === 'in' 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              )}
            >
              <Clock className="mr-2 h-5 w-5" />
              {loading ? 'Recording...' : `Punch ${type === 'in' ? 'In' : 'Out'}`}
            </Button>
          </CardContent>
        </Card>

        {/* Last punch info */}
        {lastPunchTime && (
          <div className="text-center text-sm text-gray-600">
            Last punch {type === 'in' ? 'out' : 'in'}: {lastPunchTime}
          </div>
        )}
      </div>

      {/* Attendance Request Dialog */}
      {locationError && (
        <AttendanceRequestDialog
          isOpen={showRequestDialog}
          onClose={() => {
            setShowRequestDialog(false)
            setLocationError(null)
          }}
          location={locationError.location}
          nearestLocation={locationError.nearestLocation}
          onSuccess={() => {
            toast({
              title: "Request Submitted",
              description: "Your attendance request has been submitted for approval",
            })
          }}
        />
      )}
    </>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Route, Clock, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface DailyDistanceData {
  totalDistance: number
  totalDuration?: number
  checkInCount: number
  isValidated: boolean
  anomaliesCount: number
}

export function DailyDistanceDisplay() {
  const [distanceData, setDistanceData] = useState<DailyDistanceData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTodayDistance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/distance-tracking/${today}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.distanceRecord) {
          setDistanceData({
            totalDistance: data.distanceRecord.totalDistance,
            totalDuration: data.distanceRecord.totalDuration,
            checkInCount: data.distanceRecord.checkInPoints.length,
            isValidated: data.distanceRecord.isValidated,
            anomaliesCount: data.distanceRecord.anomalies.length,
          })
        } else {
          setDistanceData({
            totalDistance: 0,
            totalDuration: 0,
            checkInCount: 0,
            isValidated: true,
            anomaliesCount: 0,
          })
        }
      }
    } catch (error) {
      console.error('Error fetching today\'s distance:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodayDistance()
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchTodayDistance, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!distanceData) {
    return null
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Today's Travel</h3>
            {!distanceData.isValidated && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Anomalies
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-gray-600">Distance</p>
                <p className="font-medium">{formatDistance(distanceData.totalDistance)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-gray-600">Duration</p>
                <p className="font-medium">{formatDuration(distanceData.totalDuration)}</p>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-600">
            {distanceData.checkInCount} check-in points recorded
            {distanceData.anomaliesCount > 0 && (
              <span className="text-red-600 ml-2">
                • {distanceData.anomaliesCount} anomalies detected
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
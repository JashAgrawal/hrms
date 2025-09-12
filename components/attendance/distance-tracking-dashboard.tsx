'use client'

import { useState, useEffect } from 'react'
import { Calendar, MapPin, Route, AlertTriangle, TrendingUp, Clock, Navigation } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface DistanceRecord {
  id: string
  employeeId: string
  date: string
  totalDistance: number
  totalDuration?: number
  checkInPoints: CheckInPoint[]
  isValidated: boolean
  anomalies: DistanceAnomaly[]
}

interface CheckInPoint {
  id: string
  timestamp: string
  location: {
    latitude: number
    longitude: number
    accuracy?: number
  }
  siteId?: string
  siteName?: string
  distanceFromPrevious?: number
  durationFromPrevious?: number
  method: 'HAVERSINE' | 'GOOGLE_MATRIX'
}

interface DistanceAnomaly {
  type: 'EXCESSIVE_SPEED' | 'IMPOSSIBLE_DISTANCE' | 'LOCATION_JUMP' | 'MISSING_ROUTE'
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  checkInPointId: string
  detectedAt: string
}

interface DistanceStatistics {
  totalDistance: number
  totalDuration: number
  averageDistancePerDay: number
  maxDistancePerDay: number
  daysWithAnomalies: number
  totalAnomalies: number
  anomaliesBySeverity: Record<string, number>
  totalDistanceKm: number
  averageDistancePerDayKm: number
  maxDistancePerDayKm: number
  totalDurationHours: number
}

const severityColors = {
  LOW: 'bg-yellow-100 text-yellow-800',
  MEDIUM: 'bg-orange-100 text-orange-800',
  HIGH: 'bg-red-100 text-red-800',
}

const anomalyTypeLabels = {
  EXCESSIVE_SPEED: 'Excessive Speed',
  IMPOSSIBLE_DISTANCE: 'Impossible Distance',
  LOCATION_JUMP: 'Location Jump',
  MISSING_ROUTE: 'Missing Route',
}

export function DistanceTrackingDashboard() {
  const [distanceRecords, setDistanceRecords] = useState<DistanceRecord[]>([])
  const [statistics, setStatistics] = useState<DistanceStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<DistanceRecord | null>(null)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
    endDate: new Date().toISOString().split('T')[0]
  })

  const fetchDistanceRecords = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })

      const response = await fetch(`/api/distance-tracking?${params}`)
      if (!response.ok) throw new Error('Failed to fetch distance records')

      const data = await response.json()
      setDistanceRecords(data.distanceRecords)
    } catch (error) {
      console.error('Error fetching distance records:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStatistics = async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })

      const response = await fetch(`/api/distance-tracking/statistics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch statistics')

      const data = await response.json()
      setStatistics(data.statistics)
    } catch (error) {
      console.error('Error fetching statistics:', error)
    }
  }

  const fetchDailyRecord = async (date: string) => {
    try {
      const response = await fetch(`/api/distance-tracking/${date}`)
      if (!response.ok) throw new Error('Failed to fetch daily record')

      const data = await response.json()
      setSelectedRecord(data.distanceRecord)
    } catch (error) {
      console.error('Error fetching daily record:', error)
    }
  }

  const recalculateDistances = async (date: string, employeeId: string) => {
    try {
      const response = await fetch(`/api/distance-tracking/${date}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employeeId }),
      })

      if (!response.ok) throw new Error('Failed to recalculate distances')

      const data = await response.json()
      setSelectedRecord(data.distanceRecord)
      
      // Refresh the records list
      fetchDistanceRecords()
    } catch (error) {
      console.error('Error recalculating distances:', error)
    }
  }

  useEffect(() => {
    fetchDistanceRecords()
    fetchStatistics()
  }, [dateRange])

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const formatSpeed = (distance: number, duration: number) => {
    if (!duration || duration === 0) return 'N/A'
    const speedKmh = (distance / 1000) / (duration / 3600)
    return `${speedKmh.toFixed(1)} km/h`
  }

  if (loading && distanceRecords.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Distance Tracking Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <Button onClick={() => { fetchDistanceRecords(); fetchStatistics(); }}>
              Update
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="records">Daily Records</TabsTrigger>
          <TabsTrigger value="details">Record Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Statistics Cards */}
          {statistics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Route className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">Total Distance</p>
                      <p className="text-2xl font-bold">{statistics.totalDistanceKm} km</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">Total Duration</p>
                      <p className="text-2xl font-bold">{statistics.totalDurationHours}h</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-sm text-gray-600">Avg Distance/Day</p>
                      <p className="text-2xl font-bold">{statistics.averageDistancePerDayKm} km</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm text-gray-600">Anomalies</p>
                      <p className="text-2xl font-bold">{statistics.totalAnomalies}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Anomalies Summary */}
          {statistics && statistics.totalAnomalies > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Anomalies Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(statistics.anomaliesBySeverity).map(([severity, count]) => (
                    <div key={severity} className="text-center">
                      <Badge className={severityColors[severity as keyof typeof severityColors]}>
                        {severity}
                      </Badge>
                      <p className="text-2xl font-bold mt-2">{count}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          {distanceRecords.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No distance records found</h3>
                <p className="text-gray-600">Distance records will appear here once field employees start checking in</p>
              </CardContent>
            </Card>
          ) : (
            distanceRecords.map((record) => (
              <Card key={record.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-4">
                        <h3 className="font-semibold text-lg">
                          {new Date(record.date).toLocaleDateString()}
                        </h3>
                        {!record.isValidated && (
                          <Badge variant="destructive">Has Anomalies</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Route className="h-4 w-4 text-blue-500" />
                          <span>Distance: {formatDistance(record.totalDistance)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-green-500" />
                          <span>Duration: {formatDuration(record.totalDuration)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-purple-500" />
                          <span>Check-ins: {record.checkInPoints.length}</span>
                        </div>
                      </div>

                      {record.anomalies.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-red-600">Anomalies Detected:</p>
                          {record.anomalies.slice(0, 2).map((anomaly, index) => (
                            <Alert key={index} variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription className="text-sm">
                                <Badge className={severityColors[anomaly.severity]} variant="outline">
                                  {anomaly.severity}
                                </Badge>
                                {' '}
                                {anomalyTypeLabels[anomaly.type]}: {anomaly.description}
                              </AlertDescription>
                            </Alert>
                          ))}
                          {record.anomalies.length > 2 && (
                            <p className="text-sm text-gray-600">
                              +{record.anomalies.length - 2} more anomalies
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDate(record.date)
                          fetchDailyRecord(record.date)
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {!selectedRecord ? (
            <Card>
              <CardContent className="text-center py-12">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No record selected</h3>
                <p className="text-gray-600">Select a daily record from the Records tab to view detailed information</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Record Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Distance Record - {new Date(selectedRecord.date).toLocaleDateString()}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => recalculateDistances(selectedRecord.date, selectedRecord.employeeId)}
                    >
                      Recalculate
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Distance</p>
                      <p className="text-xl font-bold">{formatDistance(selectedRecord.totalDistance)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Duration</p>
                      <p className="text-xl font-bold">{formatDuration(selectedRecord.totalDuration)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Check-in Points</p>
                      <p className="text-xl font-bold">{selectedRecord.checkInPoints.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Check-in Points */}
              <Card>
                <CardHeader>
                  <CardTitle>Check-in Points</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedRecord.checkInPoints.map((point, index) => (
                      <div key={point.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">#{index + 1}</Badge>
                              <span className="font-medium">
                                {new Date(point.timestamp).toLocaleTimeString()}
                              </span>
                              {point.siteName && (
                                <Badge>{point.siteName}</Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <p>Location: {point.location.latitude.toFixed(6)}, {point.location.longitude.toFixed(6)}</p>
                                {point.location.accuracy && (
                                  <p>Accuracy: ±{point.location.accuracy}m</p>
                                )}
                              </div>
                              
                              {point.distanceFromPrevious !== undefined && (
                                <div>
                                  <p>Distance from previous: {formatDistance(point.distanceFromPrevious)}</p>
                                  {point.durationFromPrevious && (
                                    <p>Duration: {formatDuration(point.durationFromPrevious)}</p>
                                  )}
                                  {point.distanceFromPrevious > 0 && point.durationFromPrevious && (
                                    <p>Speed: {formatSpeed(point.distanceFromPrevious, point.durationFromPrevious)}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <Badge variant="outline">
                            {point.method === 'GOOGLE_MATRIX' ? 'Google Maps' : 'Direct Distance'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Anomalies */}
              {selectedRecord.anomalies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Detected Anomalies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedRecord.anomalies.map((anomaly, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={severityColors[anomaly.severity]}>
                                {anomaly.severity}
                              </Badge>
                              <span className="font-medium">{anomalyTypeLabels[anomaly.type]}</span>
                            </div>
                            <p>{anomaly.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Detected at: {new Date(anomaly.detectedAt).toLocaleString()}
                            </p>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
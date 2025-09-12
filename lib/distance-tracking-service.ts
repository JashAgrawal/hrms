import { prisma } from '@/lib/prisma'
import { LocationService, GPSCoordinates } from '@/lib/location-service'

export interface DistanceCalculationResult {
  distance: number // Distance in meters
  duration?: number // Duration in seconds (from Google API)
  route?: string // Route description
  method: 'HAVERSINE' | 'GOOGLE_MATRIX' // Calculation method used
}

export interface DailyDistanceRecord {
  id: string
  employeeId: string
  date: Date
  totalDistance: number
  totalDuration?: number
  checkInPoints: CheckInPoint[]
  isValidated: boolean
  anomalies: DistanceAnomaly[]
}

export interface CheckInPoint {
  id: string
  timestamp: Date
  location: GPSCoordinates
  siteId?: string
  siteName?: string
  distanceFromPrevious?: number
  durationFromPrevious?: number
  method: 'HAVERSINE' | 'GOOGLE_MATRIX'
}

export interface DistanceAnomaly {
  type: 'EXCESSIVE_SPEED' | 'IMPOSSIBLE_DISTANCE' | 'LOCATION_JUMP' | 'MISSING_ROUTE'
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  checkInPointId: string
  detectedAt: Date
}

export interface DistanceValidationConfig {
  maxSpeedKmh: number // Maximum reasonable speed in km/h
  maxDistancePerDayKm: number // Maximum distance per day in km
  minTimeBetweenCheckins: number // Minimum time between check-ins in minutes
  enableGoogleMatrixAPI: boolean
  anomalyDetectionEnabled: boolean
}

export class DistanceTrackingService {
  private static readonly DEFAULT_CONFIG: DistanceValidationConfig = {
    maxSpeedKmh: 120, // 120 km/h max speed
    maxDistancePerDayKm: 500, // 500 km max per day
    minTimeBetweenCheckins: 5, // 5 minutes minimum
    enableGoogleMatrixAPI: true,
    anomalyDetectionEnabled: true
  }

  /**
   * Calculate distance between two points using Google Distance Matrix API
   * Falls back to Haversine formula if API fails
   */
  static async calculateDistanceWithRoute(
    origin: GPSCoordinates,
    destination: GPSCoordinates,
    config?: Partial<DistanceValidationConfig>
  ): Promise<DistanceCalculationResult> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config }

    // Try Google Distance Matrix API first if enabled
    if (finalConfig.enableGoogleMatrixAPI && process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const googleResult = await this.getGoogleDistanceMatrix(origin, destination)
        if (googleResult) {
          return googleResult
        }
      } catch (error) {
        console.warn('Google Distance Matrix API failed, falling back to Haversine:', error)
      }
    }

    // Fallback to Haversine formula
    const distance = LocationService.calculateDistance(origin, destination)
    return {
      distance,
      method: 'HAVERSINE'
    }
  }

  /**
   * Get distance and duration from Google Distance Matrix API
   */
  private static async getGoogleDistanceMatrix(
    origin: GPSCoordinates,
    destination: GPSCoordinates
  ): Promise<DistanceCalculationResult | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      throw new Error('Google Maps API key not configured')
    }

    const originStr = `${origin.latitude},${origin.longitude}`
    const destinationStr = `${destination.latitude},${destination.longitude}`
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destinationStr}&mode=driving&units=metric&key=${apiKey}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      return null
    }

    const element = data.rows[0].elements[0]
    if (element.status !== 'OK') {
      return null
    }

    return {
      distance: element.distance.value, // Distance in meters
      duration: element.duration.value, // Duration in seconds
      route: element.distance.text,
      method: 'GOOGLE_MATRIX'
    }
  }

  /**
   * Track distance for a new check-in point
   */
  static async trackCheckInDistance(
    employeeId: string,
    location: GPSCoordinates,
    siteId?: string,
    siteName?: string
  ): Promise<CheckInPoint> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Get today's existing check-in points
      const existingPoints = await prisma.distanceTrackingPoint.findMany({
        where: {
          employeeId,
          timestamp: {
            gte: today,
            lt: tomorrow
          }
        },
        orderBy: { timestamp: 'asc' }
      })

      let distanceFromPrevious = 0
      let durationFromPrevious = 0
      let method: 'HAVERSINE' | 'GOOGLE_MATRIX' = 'HAVERSINE'

      // Calculate distance from previous point if exists
      if (existingPoints.length > 0) {
        const lastPoint = existingPoints[existingPoints.length - 1]
        const previousLocation: GPSCoordinates = {
          latitude: Number(lastPoint.latitude),
          longitude: Number(lastPoint.longitude)
        }

        const distanceResult = await this.calculateDistanceWithRoute(
          previousLocation,
          location
        )

        distanceFromPrevious = distanceResult.distance
        durationFromPrevious = distanceResult.duration || 0
        method = distanceResult.method
      }

      // Create new check-in point
      const checkInPoint = await prisma.distanceTrackingPoint.create({
        data: {
          employeeId,
          timestamp: new Date(),
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          siteId,
          siteName,
          distanceFromPrevious,
          durationFromPrevious,
          calculationMethod: method
        }
      })

      // Update daily distance record
      await this.updateDailyDistanceRecord(employeeId, today)

      return {
        id: checkInPoint.id,
        timestamp: checkInPoint.timestamp,
        location: {
          latitude: Number(checkInPoint.latitude),
          longitude: Number(checkInPoint.longitude),
          accuracy: checkInPoint.accuracy ? Number(checkInPoint.accuracy) : undefined
        },
        siteId: checkInPoint.siteId || undefined,
        siteName: checkInPoint.siteName || undefined,
        distanceFromPrevious,
        durationFromPrevious,
        method
      }

    } catch (error) {
      console.error('Error tracking check-in distance:', error)
      throw new Error('Failed to track check-in distance')
    }
  }

  /**
   * Update daily distance record and detect anomalies
   */
  private static async updateDailyDistanceRecord(
    employeeId: string,
    date: Date
  ): Promise<void> {
    try {
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      // Get all points for the day
      const points = await prisma.distanceTrackingPoint.findMany({
        where: {
          employeeId,
          timestamp: {
            gte: date,
            lt: nextDay
          }
        },
        orderBy: { timestamp: 'asc' }
      })

      // Calculate total distance and duration
      const totalDistance = points.reduce((sum, point) => sum + Number(point.distanceFromPrevious || 0), 0)
      const totalDuration = points.reduce((sum, point) => sum + (point.durationFromPrevious || 0), 0)

      // Detect anomalies
      const anomalies = await this.detectAnomalies(points)

      // Upsert daily distance record
      await prisma.dailyDistanceRecord.upsert({
        where: {
          employeeId_date: {
            employeeId,
            date
          }
        },
        update: {
          totalDistance,
          totalDuration,
          checkInCount: points.length,
          isValidated: anomalies.length === 0,
          updatedAt: new Date()
        },
        create: {
          employeeId,
          date,
          totalDistance,
          totalDuration,
          checkInCount: points.length,
          isValidated: anomalies.length === 0
        }
      })

      // Store anomalies
      if (anomalies.length > 0) {
        await prisma.distanceAnomaly.createMany({
          data: anomalies.map(anomaly => ({
            employeeId,
            date,
            checkInPointId: anomaly.checkInPointId,
            type: anomaly.type,
            description: anomaly.description,
            severity: anomaly.severity,
            detectedAt: new Date()
          })),
          skipDuplicates: true
        })
      }

    } catch (error) {
      console.error('Error updating daily distance record:', error)
      throw error
    }
  }

  /**
   * Detect distance and movement anomalies
   */
  private static async detectAnomalies(
    points: any[]
  ): Promise<DistanceAnomaly[]> {
    const anomalies: DistanceAnomaly[] = []
    const config = this.DEFAULT_CONFIG

    for (let i = 1; i < points.length; i++) {
      const currentPoint = points[i]
      const previousPoint = points[i - 1]

      const distance = currentPoint.distanceFromPrevious || 0
      const timeDiff = (new Date(currentPoint.timestamp).getTime() - new Date(previousPoint.timestamp).getTime()) / 1000 // seconds
      
      // Skip if time difference is too small
      if (timeDiff < config.minTimeBetweenCheckins * 60) {
        continue
      }

      // Calculate speed in km/h
      const speedKmh = (distance / 1000) / (timeDiff / 3600)

      // Check for excessive speed
      if (speedKmh > config.maxSpeedKmh) {
        anomalies.push({
          type: 'EXCESSIVE_SPEED',
          description: `Speed of ${speedKmh.toFixed(1)} km/h exceeds maximum allowed speed of ${config.maxSpeedKmh} km/h`,
          severity: speedKmh > config.maxSpeedKmh * 1.5 ? 'HIGH' : 'MEDIUM',
          checkInPointId: currentPoint.id,
          detectedAt: new Date()
        })
      }

      // Check for impossible distance (teleportation)
      const maxPossibleDistance = (config.maxSpeedKmh * 1000) * (timeDiff / 3600) // meters
      if (distance > maxPossibleDistance * 2) {
        anomalies.push({
          type: 'IMPOSSIBLE_DISTANCE',
          description: `Distance of ${(distance / 1000).toFixed(1)} km in ${(timeDiff / 60).toFixed(1)} minutes is physically impossible`,
          severity: 'HIGH',
          checkInPointId: currentPoint.id,
          detectedAt: new Date()
        })
      }

      // Check for location jumps (large distance in short time)
      if (distance > 50000 && timeDiff < 1800) { // 50km in less than 30 minutes
        anomalies.push({
          type: 'LOCATION_JUMP',
          description: `Large distance jump of ${(distance / 1000).toFixed(1)} km in ${(timeDiff / 60).toFixed(1)} minutes`,
          severity: 'MEDIUM',
          checkInPointId: currentPoint.id,
          detectedAt: new Date()
        })
      }
    }

    // Check total daily distance
    const totalDistance = points.reduce((sum, point) => sum + (point.distanceFromPrevious || 0), 0)
    if (totalDistance > config.maxDistancePerDayKm * 1000) {
      anomalies.push({
        type: 'EXCESSIVE_SPEED',
        description: `Total daily distance of ${(totalDistance / 1000).toFixed(1)} km exceeds maximum allowed distance of ${config.maxDistancePerDayKm} km`,
        severity: 'HIGH',
        checkInPointId: points[points.length - 1]?.id || '',
        detectedAt: new Date()
      })
    }

    return anomalies
  }

  /**
   * Get daily distance record for an employee
   */
  static async getDailyDistanceRecord(
    employeeId: string,
    date: Date
  ): Promise<DailyDistanceRecord | null> {
    try {
      const record = await prisma.dailyDistanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId,
            date
          }
        },
        include: {
          anomalies: true
        }
      })

      if (!record) {
        return null
      }

      // Get check-in points for the day
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      const points = await prisma.distanceTrackingPoint.findMany({
        where: {
          employeeId,
          timestamp: {
            gte: date,
            lt: nextDay
          }
        },
        orderBy: { timestamp: 'asc' }
      })

      const checkInPoints: CheckInPoint[] = points.map(point => ({
        id: point.id,
        timestamp: point.timestamp,
        location: {
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          accuracy: point.accuracy ? Number(point.accuracy) : undefined
        },
        siteId: point.siteId || undefined,
        siteName: point.siteName || undefined,
        distanceFromPrevious: point.distanceFromPrevious ? Number(point.distanceFromPrevious) : undefined,
        durationFromPrevious: point.durationFromPrevious || undefined,
        method: point.calculationMethod as 'HAVERSINE' | 'GOOGLE_MATRIX'
      }))

      const anomalies: DistanceAnomaly[] = record.anomalies.map(anomaly => ({
        type: anomaly.type as any,
        description: anomaly.description,
        severity: anomaly.severity as any,
        checkInPointId: anomaly.checkInPointId,
        detectedAt: anomaly.detectedAt
      }))

      return {
        id: record.id,
        employeeId: record.employeeId,
        date: record.date,
        totalDistance: Number(record.totalDistance),
        totalDuration: record.totalDuration || undefined,
        checkInPoints,
        isValidated: record.isValidated,
        anomalies
      }

    } catch (error) {
      console.error('Error getting daily distance record:', error)
      throw new Error('Failed to get daily distance record')
    }
  }

  /**
   * Get distance records for a date range
   */
  static async getDistanceRecords(
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyDistanceRecord[]> {
    try {
      const records = await prisma.dailyDistanceRecord.findMany({
        where: {
          employeeId,
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          anomalies: true
        },
        orderBy: { date: 'desc' }
      })

      const result: DailyDistanceRecord[] = []

      for (const record of records) {
        const nextDay = new Date(record.date)
        nextDay.setDate(nextDay.getDate() + 1)

        const points = await prisma.distanceTrackingPoint.findMany({
          where: {
            employeeId,
            timestamp: {
              gte: record.date,
              lt: nextDay
            }
          },
          orderBy: { timestamp: 'asc' }
        })

        const checkInPoints: CheckInPoint[] = points.map(point => ({
          id: point.id,
          timestamp: point.timestamp,
          location: {
            latitude: Number(point.latitude),
            longitude: Number(point.longitude),
            accuracy: point.accuracy ? Number(point.accuracy) : undefined
          },
          siteId: point.siteId || undefined,
          siteName: point.siteName || undefined,
          distanceFromPrevious: point.distanceFromPrevious ? Number(point.distanceFromPrevious) : undefined,
          durationFromPrevious: point.durationFromPrevious || undefined,
          method: point.calculationMethod as 'HAVERSINE' | 'GOOGLE_MATRIX'
        }))

        const anomalies: DistanceAnomaly[] = record.anomalies.map(anomaly => ({
          type: anomaly.type as any,
          description: anomaly.description,
          severity: anomaly.severity as any,
          checkInPointId: anomaly.checkInPointId,
          detectedAt: anomaly.detectedAt
        }))

        result.push({
          id: record.id,
          employeeId: record.employeeId,
          date: record.date,
          totalDistance: Number(record.totalDistance),
          totalDuration: record.totalDuration || undefined,
          checkInPoints,
          isValidated: record.isValidated,
          anomalies
        })
      }

      return result

    } catch (error) {
      console.error('Error getting distance records:', error)
      throw new Error('Failed to get distance records')
    }
  }

  /**
   * Validate and recalculate distances for a specific date
   */
  static async recalculateDistances(
    employeeId: string,
    date: Date
  ): Promise<DailyDistanceRecord> {
    try {
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      // Get all points for the day
      const points = await prisma.distanceTrackingPoint.findMany({
        where: {
          employeeId,
          timestamp: {
            gte: date,
            lt: nextDay
          }
        },
        orderBy: { timestamp: 'asc' }
      })

      // Recalculate distances between consecutive points
      for (let i = 1; i < points.length; i++) {
        const currentPoint = points[i]
        const previousPoint = points[i - 1]

        const previousLocation: GPSCoordinates = {
          latitude: Number(previousPoint.latitude),
          longitude: Number(previousPoint.longitude)
        }

        const currentLocation: GPSCoordinates = {
          latitude: Number(currentPoint.latitude),
          longitude: Number(currentPoint.longitude)
        }

        const distanceResult = await this.calculateDistanceWithRoute(
          previousLocation,
          currentLocation
        )

        // Update the point with recalculated distance
        await prisma.distanceTrackingPoint.update({
          where: { id: currentPoint.id },
          data: {
            distanceFromPrevious: distanceResult.distance,
            durationFromPrevious: distanceResult.duration || 0,
            calculationMethod: distanceResult.method
          }
        })
      }

      // Update daily record
      await this.updateDailyDistanceRecord(employeeId, date)

      // Return updated record
      const updatedRecord = await this.getDailyDistanceRecord(employeeId, date)
      if (!updatedRecord) {
        throw new Error('Failed to get updated distance record')
      }

      return updatedRecord

    } catch (error) {
      console.error('Error recalculating distances:', error)
      throw new Error('Failed to recalculate distances')
    }
  }

  /**
   * Get distance statistics for an employee
   */
  static async getDistanceStatistics(
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalDistance: number
    totalDuration: number
    averageDistancePerDay: number
    maxDistancePerDay: number
    daysWithAnomalies: number
    totalAnomalies: number
    anomaliesBySeverity: Record<string, number>
  }> {
    try {
      const records = await prisma.dailyDistanceRecord.findMany({
        where: {
          employeeId,
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          anomalies: true
        }
      })

      const totalDistance = records.reduce((sum, record) => sum + Number(record.totalDistance), 0)
      const totalDuration = records.reduce((sum, record) => sum + (record.totalDuration || 0), 0)
      const maxDistancePerDay = Math.max(...records.map(record => Number(record.totalDistance)), 0)
      const averageDistancePerDay = records.length > 0 ? totalDistance / records.length : 0

      const daysWithAnomalies = records.filter(record => record.anomalies.length > 0).length
      const totalAnomalies = records.reduce((sum, record) => sum + record.anomalies.length, 0)

      const anomaliesBySeverity = records.reduce((acc, record) => {
        record.anomalies.forEach(anomaly => {
          acc[anomaly.severity] = (acc[anomaly.severity] || 0) + 1
        })
        return acc
      }, {} as Record<string, number>)

      return {
        totalDistance,
        totalDuration,
        averageDistancePerDay,
        maxDistancePerDay,
        daysWithAnomalies,
        totalAnomalies,
        anomaliesBySeverity
      }

    } catch (error) {
      console.error('Error getting distance statistics:', error)
      throw new Error('Failed to get distance statistics')
    }
  }
}
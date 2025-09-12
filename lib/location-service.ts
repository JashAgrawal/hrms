import { prisma } from '@/lib/prisma'

export interface GPSCoordinates {
  latitude: number
  longitude: number
  accuracy?: number
  timestamp?: Date | string
}

export interface EmployeeLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  radius: number
  isOfficeLocation: boolean
  officeLocationId?: string
  isActive: boolean
}

export interface LocationValidationResult {
  isValid: boolean
  nearestLocation?: {
    id: string
    name: string
    distance: number
  } | null
  requiresApproval: boolean
  validLocations: Array<{
    id: string
    name: string
    distance: number
    isWithinRadius: boolean
  }>
}

export interface OfficeLocation {
  id: string
  name: string
  code: string
  address: string
  city: string
  state: string
  latitude: number
  longitude: number
  radius: number
  timezone: string
  isActive: boolean
}

export class LocationService {
  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * @param point1 First GPS coordinate
   * @param point2 Second GPS coordinate
   * @returns Distance in meters
   */
  static calculateDistance(point1: GPSCoordinates, point2: GPSCoordinates): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = point1.latitude * Math.PI / 180
    const φ2 = point2.latitude * Math.PI / 180
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c // Distance in meters
  }

  /**
   * Validate if employee's current location is within assigned locations
   * @param employeeId Employee ID
   * @param currentLocation Current GPS coordinates
   * @returns Location validation result
   */
  static async validateEmployeeLocation(
    employeeId: string, 
    currentLocation: GPSCoordinates
  ): Promise<LocationValidationResult> {
    try {
      // Get employee's assigned locations
      const employeeLocations = await prisma.employeeLocation.findMany({
        where: {
          employeeId,
          isActive: true
        },
        include: {
          officeLocation: true,
          location: true
        }
      })

      if (employeeLocations.length === 0) {
        return {
          isValid: false,
          requiresApproval: true,
          validLocations: []
        }
      }

      const validLocations = []
      let nearestLocation = null
      let minDistance = Infinity
      let isValid = false

      for (const empLoc of employeeLocations) {
        // Use office location coordinates if it's an office location, otherwise use custom location
        const locationCoords = empLoc.officeLocation 
          ? {
              latitude: Number(empLoc.officeLocation.latitude),
              longitude: Number(empLoc.officeLocation.longitude)
            }
          : empLoc.location
          ? {
              latitude: Number(empLoc.location.latitude),
              longitude: Number(empLoc.location.longitude)
            }
          : {
              latitude: Number(empLoc.latitude),
              longitude: Number(empLoc.longitude)
            }

        const distance = this.calculateDistance(currentLocation, locationCoords)
        const radius = empLoc.officeLocation?.radius || empLoc.location?.radius || empLoc.radius
        const isWithinRadius = distance <= radius

        if (isWithinRadius) {
          isValid = true
        }

        if (distance < minDistance) {
          minDistance = distance
          nearestLocation = {
            id: empLoc.id,
            name: empLoc.name,
            distance: Math.round(distance)
          }
        }

        validLocations.push({
          id: empLoc.id,
          name: empLoc.name,
          distance: Math.round(distance),
          isWithinRadius
        })
      }

      return {
        isValid,
        nearestLocation: nearestLocation || undefined,
        requiresApproval: !isValid,
        validLocations
      }

    } catch (error) {
      console.error('Error validating employee location:', error)
      throw new Error('Failed to validate location')
    }
  }

  /**
   * Assign locations to an employee
   * @param employeeId Employee ID
   * @param locations Array of locations to assign
   * @param assignedBy User ID who is assigning the locations
   */
  static async assignLocationsToEmployee(
    employeeId: string, 
    locations: Omit<EmployeeLocation, 'id'>[], 
    assignedBy: string
  ): Promise<void> {
    try {
      // Validate employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId }
      })

      if (!employee) {
        throw new Error('Employee not found')
      }

      // Validate maximum 5 locations per employee
      if (locations.length > 5) {
        throw new Error('Maximum 5 locations can be assigned per employee')
      }

      // Deactivate existing locations
      await prisma.employeeLocation.updateMany({
        where: { employeeId },
        data: { isActive: false }
      })

      // Create new location assignments
      const locationData = locations.map(location => ({
        employeeId,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: location.radius,
        isOfficeLocation: location.isOfficeLocation,
        officeLocationId: location.officeLocationId,
        isActive: true,
        assignedBy,
        assignedAt: new Date()
      }))

      await prisma.employeeLocation.createMany({
        data: locationData
      })

    } catch (error) {
      console.error('Error assigning locations to employee:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to assign locations')
    }
  }

  /**
   * Get employee's assigned locations
   * @param employeeId Employee ID
   * @returns Array of assigned locations
   */
  static async getEmployeeLocations(employeeId: string): Promise<EmployeeLocation[]> {
    try {
      const employeeLocations = await prisma.employeeLocation.findMany({
        where: {
          employeeId,
          isActive: true
        },
        include: {
          officeLocation: true,
          location: true
        },
        orderBy: { assignedAt: 'desc' }
      })

      return employeeLocations.map(empLoc => ({
        id: empLoc.id,
        name: empLoc.name,
        latitude: Number(empLoc.latitude),
        longitude: Number(empLoc.longitude),
        radius: empLoc.radius,
        isOfficeLocation: empLoc.isOfficeLocation,
        officeLocationId: empLoc.officeLocationId || undefined,
        isActive: empLoc.isActive
      }))

    } catch (error) {
      console.error('Error getting employee locations:', error)
      throw new Error('Failed to get employee locations')
    }
  }

  /**
   * Get all office locations
   * @returns Array of office locations
   */
  static async getOfficeLocations(): Promise<OfficeLocation[]> {
    try {
      const officeLocations = await prisma.officeLocation.findMany({
        where: { isActive: true },
        orderBy: [
          { isHeadOffice: 'desc' },
          { name: 'asc' }
        ]
      })

      return officeLocations.map(office => ({
        id: office.id,
        name: office.name,
        code: office.code,
        address: office.address,
        city: office.city,
        state: office.state,
        latitude: Number(office.latitude),
        longitude: Number(office.longitude),
        radius: office.radius,
        timezone: office.timezone,
        isActive: office.isActive
      }))

    } catch (error) {
      console.error('Error getting office locations:', error)
      throw new Error('Failed to get office locations')
    }
  }

  /**
   * Create a new office location
   * @param officeData Office location data
   * @returns Created office location
   */
  static async createOfficeLocation(officeData: Omit<OfficeLocation, 'id'>): Promise<OfficeLocation> {
    try {
      const office = await prisma.officeLocation.create({
        data: {
          name: officeData.name,
          code: officeData.code,
          address: officeData.address,
          city: officeData.city,
          state: officeData.state,
          latitude: officeData.latitude,
          longitude: officeData.longitude,
          radius: officeData.radius,
          timezone: officeData.timezone,
          isActive: officeData.isActive
        }
      })

      return {
        id: office.id,
        name: office.name,
        code: office.code,
        address: office.address,
        city: office.city,
        state: office.state,
        latitude: Number(office.latitude),
        longitude: Number(office.longitude),
        radius: office.radius,
        timezone: office.timezone,
        isActive: office.isActive
      }

    } catch (error) {
      console.error('Error creating office location:', error)
      throw new Error('Failed to create office location')
    }
  }

  /**
   * Update an office location
   * @param id Office location ID
   * @param officeData Updated office location data
   * @returns Updated office location
   */
  static async updateOfficeLocation(
    id: string, 
    officeData: Partial<Omit<OfficeLocation, 'id'>>
  ): Promise<OfficeLocation> {
    try {
      const office = await prisma.officeLocation.update({
        where: { id },
        data: officeData
      })

      return {
        id: office.id,
        name: office.name,
        code: office.code,
        address: office.address,
        city: office.city,
        state: office.state,
        latitude: Number(office.latitude),
        longitude: Number(office.longitude),
        radius: office.radius,
        timezone: office.timezone,
        isActive: office.isActive
      }

    } catch (error) {
      console.error('Error updating office location:', error)
      throw new Error('Failed to update office location')
    }
  }

  /**
   * Delete an office location
   * @param id Office location ID
   */
  static async deleteOfficeLocation(id: string): Promise<void> {
    try {
      // Check if location is assigned to any employees
      const assignedCount = await prisma.employeeLocation.count({
        where: {
          officeLocationId: id,
          isActive: true
        }
      })

      if (assignedCount > 0) {
        throw new Error('Cannot delete office location that is assigned to employees')
      }

      await prisma.officeLocation.update({
        where: { id },
        data: { isActive: false }
      })

    } catch (error) {
      console.error('Error deleting office location:', error)
      throw new Error('Failed to delete office location')
    }
  }

  /**
   * Get location validation status for current employee location
   * @param employeeId Employee ID
   * @param currentLocation Current GPS coordinates
   * @returns Detailed location status
   */
  static async getLocationStatus(
    employeeId: string, 
    currentLocation: GPSCoordinates
  ): Promise<{
    isValid: boolean
    currentLocation: GPSCoordinates
    assignedLocations: EmployeeLocation[]
    validation: LocationValidationResult
  }> {
    try {
      const [assignedLocations, validation] = await Promise.all([
        this.getEmployeeLocations(employeeId),
        this.validateEmployeeLocation(employeeId, currentLocation)
      ])

      return {
        isValid: validation.isValid,
        currentLocation,
        assignedLocations,
        validation
      }

    } catch (error) {
      console.error('Error getting location status:', error)
      throw new Error('Failed to get location status')
    }
  }
}
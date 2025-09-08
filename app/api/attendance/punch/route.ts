import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon1-lon2) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, location, timestamp } = body

    // Get employee info with assigned locations
    const employee = await prisma.employee.findFirst({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        employeeLocations: {
          where: { isActive: true },
          include: {
            location: true
          }
        }
      }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check geo-fencing if location is provided and employee has assigned locations
    let isWithinAllowedLocation = true
    let nearestLocation = null
    let distanceFromNearest = null

    if (location && location.latitude && location.longitude && employee.employeeLocations.length > 0) {
      isWithinAllowedLocation = false
      let minDistance = Infinity

      for (const empLoc of employee.employeeLocations) {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          Number(empLoc.location.latitude),
          Number(empLoc.location.longitude)
        )

        if (distance < minDistance) {
          minDistance = distance
          nearestLocation = empLoc.location
          distanceFromNearest = distance
        }

        if (distance <= empLoc.location.radius) {
          isWithinAllowedLocation = true
          break
        }
      }
    }

    // If not within allowed location, return error with option to request approval
    if (!isWithinAllowedLocation && employee.employeeLocations.length > 0) {
      return NextResponse.json({
        error: 'LOCATION_NOT_ALLOWED',
        message: 'You are not within any of your assigned work locations',
        details: {
          nearestLocation: nearestLocation ? {
            name: nearestLocation.name,
            address: nearestLocation.address,
            distance: Math.round(distanceFromNearest || 0),
            allowedRadius: nearestLocation.radius
          } : null,
          canRequestApproval: true
        }
      }, { status: 403 })
    }

    const punchTime = new Date(timestamp)
    const dateOnly = new Date(punchTime.getFullYear(), punchTime.getMonth(), punchTime.getDate())

    // Get or create attendance record for today
    let attendanceRecord = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: dateOnly,
        }
      }
    })

    if (!attendanceRecord) {
      attendanceRecord = await prisma.attendanceRecord.create({
        data: {
          employeeId: employee.id,
          date: dateOnly,
          status: 'PRESENT',
          method: 'WEB',
        }
      })
    }

    // Create check-in/out record
    const checkInOut = await prisma.checkInOut.create({
      data: {
        attendanceId: attendanceRecord.id,
        employeeId: employee.id,
        type: type === 'IN' ? 'CHECK_IN' : 'CHECK_OUT',
        timestamp: punchTime,
        location: location || null,
        method: 'WEB',
        isManualEntry: false,
      }
    })

    // Update attendance record with check-in/out times
    const updateData: any = {}
    if (type === 'IN') {
      updateData.checkIn = punchTime
    } else {
      updateData.checkOut = punchTime
      
      // Calculate work hours if both check-in and check-out exist
      if (attendanceRecord.checkIn) {
        const workHours = (punchTime.getTime() - attendanceRecord.checkIn.getTime()) / (1000 * 60 * 60)
        updateData.workHours = Math.max(0, workHours)
      }
    }

    await prisma.attendanceRecord.update({
      where: { id: attendanceRecord.id },
      data: updateData
    })

    // Log the punch action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: type === 'IN' ? 'CHECK_IN' : 'CHECK_OUT',
        resource: 'ATTENDANCE',
        resourceId: attendanceRecord.id,
        newValues: {
          timestamp: punchTime.toISOString(),
          location: location,
          method: 'WEB',
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Punch ${type.toLowerCase()} recorded successfully`,
      data: {
        timestamp: punchTime.toISOString(),
        type,
        location,
        attendanceId: attendanceRecord.id,
      }
    })

  } catch (error) {
    console.error('Error recording punch:', error)
    return NextResponse.json(
      { error: 'Failed to record punch' },
      { status: 500 }
    )
  }
}
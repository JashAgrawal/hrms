import { prisma } from '@/lib/prisma'

/**
 * Get attendance cutoff configuration from environment variables
 */
function getAttendanceCutoffConfig() {
  const cutoffHour = parseInt(process.env.ATTENDANCE_CUTOFF_HOUR || '18')
  const cutoffMinute = parseInt(process.env.ATTENDANCE_CUTOFF_MINUTE || '0')

  // Validate hour (0-23)
  if (cutoffHour < 0 || cutoffHour > 23) {
    console.warn(`Invalid ATTENDANCE_CUTOFF_HOUR: ${cutoffHour}. Using default 18.`)
    return { hour: 18, minute: 0 }
  }

  // Validate minute (0-59)
  if (cutoffMinute < 0 || cutoffMinute > 59) {
    console.warn(`Invalid ATTENDANCE_CUTOFF_MINUTE: ${cutoffMinute}. Using default 0.`)
    return { hour: cutoffHour, minute: 0 }
  }

  return { hour: cutoffHour, minute: cutoffMinute }
}

export interface AbsenceMarkingJobResult {
  success: boolean
  processed: number
  errors: Array<{ employeeId: string; error: string }>
  summary: {
    totalRecordsFound: number
    successful: number
    failed: number
    skipped: number
  }
  processedEmployees: Array<{
    employeeId: string
    employeeCode: string
    employeeName: string
    checkInTime: string
    previousStatus: string
  }>
}

/**
 * Automatically mark employees as absent if they haven't checked out by the configured cutoff time
 * This function should be called daily after the cutoff time
 * Cutoff time can be configured via ATTENDANCE_CUTOFF_HOUR and ATTENDANCE_CUTOFF_MINUTE environment variables
 * Defaults to 6:00 PM (18:00) if not configured
 */
export async function markAbsentForMissingCheckout(
  targetDate?: Date
): Promise<AbsenceMarkingJobResult> {
  const result: AbsenceMarkingJobResult = {
    success: false,
    processed: 0,
    errors: [],
    summary: {
      totalRecordsFound: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    },
    processedEmployees: [],
  }

  try {
    // Use provided date or current date
    const today = targetDate || new Date()
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    
    // Set cutoff time - configurable via environment variables
    const cutoffConfig = getAttendanceCutoffConfig()
    const cutoffTime = new Date(dateOnly)
    cutoffTime.setHours(cutoffConfig.hour, cutoffConfig.minute, 0, 0)
    
    const currentTime = new Date()
    
    // Only run this job if current time is after the cutoff time
    if (currentTime < cutoffTime) {
      console.log(`Skipping absence marking - current time (${currentTime.toLocaleTimeString()}) is before cutoff time (${cutoffTime.toLocaleTimeString()})`)
      result.success = true
      return result
    }

    console.log(`Starting absence marking for ${dateOnly.toDateString()} at ${currentTime.toLocaleTimeString()}`)

    // Find attendance records where employees checked in but haven't checked out by cutoff time
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        date: dateOnly,
        checkIn: {
          not: null, // Employee checked in
        },
        checkOut: null, // Employee hasn't checked out
        status: {
          notIn: ['ABSENT', 'ON_LEAVE', 'HOLIDAY'], // Don't process already absent or leave records
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    })

    result.summary.totalRecordsFound = attendanceRecords.length

    if (attendanceRecords.length === 0) {
      console.log('No attendance records found that need absence marking')
      result.success = true
      return result
    }

    console.log(`Found ${attendanceRecords.length} attendance records to process`)

    // Process each attendance record
    for (const record of attendanceRecords) {
      try {
        // Skip inactive employees
        if (record.employee.status !== 'ACTIVE') {
          console.log(`Skipping ${record.employee.employeeCode} - employee status is ${record.employee.status}`)
          result.summary.skipped++
          continue
        }

        // Don't mark as absent if employee checked in - they were present
        // Instead, just auto-checkout with a note
        const previousStatus = record.status
        const employeeName = `${record.employee.firstName} ${record.employee.lastName}`

        if (record.checkIn) {
          // Employee checked in but forgot to check out - auto checkout
          await prisma.attendanceRecord.update({
            where: { id: record.id },
            data: {
              checkOut: cutoffTime, // Auto checkout at cutoff time
              status: 'PRESENT', // They were present since they checked in
              notes: record.notes
                ? `${record.notes}\n[AUTO] Auto checkout at ${cutoffTime.toLocaleString()} - missing manual checkout`
                : `[AUTO] Auto checkout at ${cutoffTime.toLocaleString()} - missing manual checkout`,
              updatedAt: currentTime,
            },
          })

          console.log(`Auto checkout for ${record.employee.employeeCode} - ${employeeName}`)
        } else {
          // No check-in at all - mark as absent
          await prisma.attendanceRecord.update({
            where: { id: record.id },
            data: {
              status: 'ABSENT',
              notes: record.notes
                ? `${record.notes}\n[AUTO] Marked absent - no check-in recorded on ${currentTime.toLocaleString()}`
                : `[AUTO] Marked absent - no check-in recorded on ${currentTime.toLocaleString()}`,
              updatedAt: currentTime,
            },
          })

          console.log(`Marked absent ${record.employee.employeeCode} - ${employeeName} (no check-in)`)
        }

        // Create audit log for this action
        await prisma.auditLog.create({
          data: {
            userId: 'SYSTEM', // System-generated action
            action: 'ATTENDANCE_AUTO_ABSENT',
            resource: 'ATTENDANCE',
            resourceId: record.id,
            oldValues: {
              status: previousStatus,
            },
            newValues: {
              status: 'ABSENT',
              reason: 'Missing checkout by 12 PM',
              processedAt: currentTime,
            },
            ipAddress: 'SYSTEM',
            userAgent: 'Attendance Absence Scheduler',
          },
        })

        console.log(`Marked ${record.employee.employeeCode} (${employeeName}) as absent - checked in at ${record.checkIn?.toLocaleTimeString()} but no checkout by 12 PM`)
        
        result.processedEmployees.push({
          employeeId: record.employee.id,
          employeeCode: record.employee.employeeCode,
          employeeName,
          checkInTime: record.checkIn?.toLocaleString() || '',
          previousStatus,
        })
        
        result.summary.successful++
        result.processed++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error processing employee ${record.employee.employeeCode}:`, error)
        
        result.errors.push({
          employeeId: record.employee.id,
          error: errorMessage,
        })
        result.summary.failed++
      }
    }

    result.success = true
    console.log(`Absence marking completed: ${result.summary.successful} successful, ${result.summary.failed} failed, ${result.summary.skipped} skipped`)

    return result
  } catch (error) {
    console.error('Error in absence marking job:', error)
    result.errors.push({
      employeeId: 'SYSTEM',
      error: error instanceof Error ? error.message : 'System error',
    })
    return result
  }
}

/**
 * Mark absent for a specific employee (for manual corrections)
 */
export async function markEmployeeAbsentForMissingCheckout(
  employeeId: string,
  targetDate?: Date,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const today = targetDate || new Date()
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const attendanceRecord = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: dateOnly,
        },
      },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!attendanceRecord) {
      return { success: false, message: 'Attendance record not found' }
    }

    if (!attendanceRecord.checkIn) {
      return { success: false, message: 'Employee did not check in' }
    }

    if (attendanceRecord.checkOut) {
      return { success: false, message: 'Employee already checked out' }
    }

    if (attendanceRecord.status === 'ABSENT') {
      return { success: false, message: 'Employee already marked as absent' }
    }

    const previousStatus = attendanceRecord.status
    const currentTime = new Date()
    const customReason = reason || 'Missing checkout by end of day'

    // Update attendance record
    await prisma.attendanceRecord.update({
      where: { id: attendanceRecord.id },
      data: {
        status: 'ABSENT',
        notes: attendanceRecord.notes 
          ? `${attendanceRecord.notes}\n[MANUAL] ${customReason} on ${currentTime.toLocaleString()}`
          : `[MANUAL] ${customReason} on ${currentTime.toLocaleString()}`,
        updatedAt: currentTime,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: 'SYSTEM',
        action: 'ATTENDANCE_MANUAL_ABSENT',
        resource: 'ATTENDANCE',
        resourceId: attendanceRecord.id,
        oldValues: {
          status: previousStatus,
        },
        newValues: {
          status: 'ABSENT',
          reason: customReason,
          processedAt: currentTime,
        },
        ipAddress: 'SYSTEM',
        userAgent: 'Manual Absence Marking',
      },
    })

    const employeeName = `${attendanceRecord.employee.firstName} ${attendanceRecord.employee.lastName}`
    return { 
      success: true, 
      message: `Successfully marked ${attendanceRecord.employee.employeeCode} (${employeeName}) as absent` 
    }
  } catch (error) {
    console.error('Error marking employee absent:', error)
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get statistics about potential absence markings (for preview/reporting)
 */
export async function getAbsenceMarkingPreview(targetDate?: Date): Promise<{
  totalRecords: number
  eligibleForMarking: number
  alreadyProcessed: number
  employees: Array<{
    employeeCode: string
    employeeName: string
    checkInTime: string
    currentStatus: string
  }>
}> {
  const today = targetDate || new Date()
  const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      date: dateOnly,
      checkIn: { not: null },
    },
    include: {
      employee: {
        select: {
          employeeCode: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      },
    },
  })

  const eligibleRecords = attendanceRecords.filter(record => 
    record.checkOut === null && 
    !['ABSENT', 'ON_LEAVE', 'HOLIDAY'].includes(record.status) &&
    record.employee.status === 'ACTIVE'
  )

  const alreadyProcessed = attendanceRecords.filter(record => 
    record.status === 'ABSENT'
  ).length

  return {
    totalRecords: attendanceRecords.length,
    eligibleForMarking: eligibleRecords.length,
    alreadyProcessed,
    employees: eligibleRecords.map(record => ({
      employeeCode: record.employee.employeeCode,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      checkInTime: record.checkIn?.toLocaleString() || '',
      currentStatus: record.status,
    })),
  }
}

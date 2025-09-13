// Shared utilities for the Time Tracker module

import { format, parseISO, differenceInMinutes, addMinutes } from 'date-fns'
import { TimeEntry, Project, Timesheet } from './types'

/**
 * Calculate total hours from time entries
 */
export function calculateTotalHours(entries: TimeEntry[]): {
  totalHours: number
  billableHours: number
  nonBillableHours: number
  overtimeHours: number
} {
  return entries.reduce(
    (acc, entry) => ({
      totalHours: acc.totalHours + entry.billableHours + entry.nonBillableHours + entry.overtimeHours,
      billableHours: acc.billableHours + entry.billableHours,
      nonBillableHours: acc.nonBillableHours + entry.nonBillableHours,
      overtimeHours: acc.overtimeHours + entry.overtimeHours
    }),
    { totalHours: 0, billableHours: 0, nonBillableHours: 0, overtimeHours: 0 }
  )
}

/**
 * Calculate hours between start and end time
 */
export function calculateHoursBetweenTimes(
  startTime: string,
  endTime: string,
  breakDuration: number = 0
): number {
  const start = parseISO(`2000-01-01T${startTime}:00`)
  const end = parseISO(`2000-01-01T${endTime}:00`)
  const totalMinutes = differenceInMinutes(end, start) - breakDuration
  return Math.max(0, totalMinutes / 60)
}

/**
 * Format hours to display string
 */
export function formatHours(hours: number): string {
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  
  if (minutes === 0) {
    return `${wholeHours}h`
  }
  
  return `${wholeHours}h ${minutes}m`
}

/**
 * Format time string for display
 */
export function formatTime(timeString: string): string {
  try {
    const time = parseISO(`2000-01-01T${timeString}:00`)
    return format(time, 'h:mm a')
  } catch {
    return timeString
  }
}

/**
 * Format date string for display
 */
export function formatDate(dateString: string): string {
  try {
    const date = parseISO(dateString)
    return format(date, 'MMM dd, yyyy')
  } catch {
    return dateString
  }
}

/**
 * Format date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  try {
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    
    if (format(start, 'yyyy-MM') === format(end, 'yyyy-MM')) {
      // Same month
      return `${format(start, 'MMM dd')} - ${format(end, 'dd, yyyy')}`
    } else if (format(start, 'yyyy') === format(end, 'yyyy')) {
      // Same year
      return `${format(start, 'MMM dd')} - ${format(end, 'MMM dd, yyyy')}`
    } else {
      // Different years
      return `${format(start, 'MMM dd, yyyy')} - ${format(end, 'MMM dd, yyyy')}`
    }
  } catch {
    return `${startDate} - ${endDate}`
  }
}

/**
 * Get status color for badges
 */
export function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800 hover:bg-green-200'
    case 'COMPLETED':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
    case 'ON_HOLD':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 hover:bg-red-200'
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    case 'SUBMITTED':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
    case 'APPROVED':
      return 'bg-green-100 text-green-800 hover:bg-green-200'
    case 'REJECTED':
      return 'bg-red-100 text-red-800 hover:bg-red-200'
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
  }
}

/**
 * Validate time entry
 */
export function validateTimeEntry(entry: TimeEntry): string[] {
  const errors: string[] = []
  
  if (!entry.date) {
    errors.push('Date is required')
  }
  
  if (entry.startTime && entry.endTime) {
    const start = parseISO(`2000-01-01T${entry.startTime}:00`)
    const end = parseISO(`2000-01-01T${entry.endTime}:00`)
    
    if (end <= start) {
      errors.push('End time must be after start time')
    }
  }
  
  if (entry.billableHours < 0) {
    errors.push('Billable hours cannot be negative')
  }
  
  if (entry.nonBillableHours < 0) {
    errors.push('Non-billable hours cannot be negative')
  }
  
  if (entry.overtimeHours < 0) {
    errors.push('Overtime hours cannot be negative')
  }
  
  if (entry.breakDuration < 0) {
    errors.push('Break duration cannot be negative')
  }
  
  return errors
}

/**
 * Validate project data
 */
export function validateProject(project: Partial<Project>): string[] {
  const errors: string[] = []
  
  if (!project.name?.trim()) {
    errors.push('Project name is required')
  }
  
  if (!project.code?.trim()) {
    errors.push('Project code is required')
  }
  
  if (!project.startDate) {
    errors.push('Start date is required')
  }
  
  if (project.endDate && project.startDate) {
    const start = parseISO(project.startDate)
    const end = parseISO(project.endDate)
    
    if (end <= start) {
      errors.push('End date must be after start date')
    }
  }
  
  return errors
}

/**
 * Generate time options for dropdowns
 */
export function generateTimeOptions(interval: number = 15): string[] {
  const options: string[] = []
  const start = new Date('2000-01-01T00:00:00')
  
  for (let i = 0; i < 24 * 60; i += interval) {
    const time = addMinutes(start, i)
    options.push(format(time, 'HH:mm'))
  }
  
  return options
}

/**
 * Calculate utilization percentage
 */
export function calculateUtilization(actualHours: number, targetHours: number): number {
  if (targetHours === 0) return 0
  return Math.round((actualHours / targetHours) * 100)
}

/**
 * Group time entries by project
 */
export function groupEntriesByProject(entries: TimeEntry[]): Record<string, TimeEntry[]> {
  return entries.reduce((acc, entry) => {
    const projectId = entry.projectId || 'unassigned'
    if (!acc[projectId]) {
      acc[projectId] = []
    }
    acc[projectId].push(entry)
    return acc
  }, {} as Record<string, TimeEntry[]>)
}

/**
 * Calculate project hours summary
 */
export function calculateProjectHours(entries: TimeEntry[]): Array<{
  projectId: string
  projectName: string
  totalHours: number
  billableHours: number
  nonBillableHours: number
  overtimeHours: number
}> {
  const grouped = groupEntriesByProject(entries)
  
  return Object.entries(grouped).map(([projectId, projectEntries]) => {
    const totals = calculateTotalHours(projectEntries)
    const projectName = projectEntries[0]?.project?.name || 'Unassigned'
    
    return {
      projectId,
      projectName,
      ...totals
    }
  })
}

/**
 * Export timesheet data to CSV format
 */
export function exportTimesheetToCSV(timesheet: Timesheet): string {
  const headers = [
    'Date',
    'Start Time',
    'End Time',
    'Break Duration (min)',
    'Project',
    'Task Description',
    'Billable Hours',
    'Non-billable Hours',
    'Overtime Hours'
  ]
  
  const rows = timesheet.entries.map(entry => [
    entry.date,
    entry.startTime || '',
    entry.endTime || '',
    entry.breakDuration.toString(),
    entry.project?.name || '',
    entry.taskDescription || '',
    entry.billableHours.toString(),
    entry.nonBillableHours.toString(),
    entry.overtimeHours.toString()
  ])
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n')
  
  return csvContent
}

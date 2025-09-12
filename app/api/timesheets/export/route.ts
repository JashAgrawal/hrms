import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, checkPermission } from '@/lib/auth'
import { z } from 'zod'
import { format as formatDate } from 'date-fns'

const ExportQuerySchema = z.object({
  ids: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  employeeId: z.string().optional(),
  projectId: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  format: z.enum(['csv', 'excel']).optional().default('csv')
})

export async function GET(request: NextRequest) {
  try {
    // Check permissions
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'READ',
      resource: 'ALL'
    })
    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      ids: searchParams.get('ids'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      employeeId: searchParams.get('employeeId'),
      projectId: searchParams.get('projectId'),
      status: searchParams.get('status'),
      format: searchParams.get('format') || 'csv'
    }

    const validatedParams = ExportQuerySchema.parse(queryParams)
    const { ids, startDate, endDate, employeeId, projectId, status, format } = validatedParams

    // Build filter conditions
    const where: any = {}

    if (ids) {
      where.id = { in: ids.split(',') }
    } else {
      if (startDate) where.startDate = { gte: new Date(startDate) }
      if (endDate) where.endDate = { lte: new Date(endDate) }
      if (employeeId) where.employeeId = employeeId
      if (status) where.status = status
    }

    // Fetch timesheets with related data
    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        employee: {
          include: {
            department: true
          }
        },
        entries: {
          include: {
            project: true
          },
          ...(projectId && { where: { projectId } })
        },
        approver: true
      },
      orderBy: [
        { startDate: 'desc' },
        { employee: { lastName: 'asc' } }
      ]
    })

    if (timesheets.length === 0) {
      return NextResponse.json({ error: 'No timesheets found' }, { status: 404 })
    }

    // Generate export data
    const exportData = generateExportData(timesheets)

    if (format === 'csv') {
      const csv = generateCSV(exportData)
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="timesheets-export-${formatDate(new Date(), 'yyyy-MM-dd')}.csv"`
        }
      })
    } else {
      // For Excel format, you would typically use a library like 'exceljs'
      // For now, we'll return CSV with Excel-friendly formatting
      const csv = generateCSV(exportData, true)
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'application/vnd.ms-excel',
          'Content-Disposition': `attachment; filename="timesheets-export-${formatDate(new Date(), 'yyyy-MM-dd')}.xls"`
        }
      })
    }

  } catch (error) {
    console.error('Export API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface ExportRow {
  timesheetId: string
  employeeName: string
  employeeId: string
  department: string
  timesheetPeriod: string
  status: string
  totalHours: number
  billableHours: number
  nonBillableHours: number
  overtimeHours: number
  submittedAt: string
  approvedAt: string
  approverName: string
  entryDate: string
  entryStartTime: string
  entryEndTime: string
  entryBreakDuration: number
  projectCode: string
  projectName: string
  taskDescription: string
  entryBillableHours: number
  entryNonBillableHours: number
  entryOvertimeHours: number
}

function generateExportData(timesheets: any[]): ExportRow[] {
  const exportData: ExportRow[] = []

  timesheets.forEach(timesheet => {
    const baseRow = {
      timesheetId: timesheet.id,
      employeeName: `${timesheet.employee.firstName} ${timesheet.employee.lastName}`,
      employeeId: timesheet.employee.employeeId,
      department: timesheet.employee.department?.name || 'N/A',
      timesheetPeriod: `${formatDate(timesheet.startDate, 'MMM dd')} - ${formatDate(timesheet.endDate, 'MMM dd, yyyy')}`,
      status: timesheet.status,
      totalHours: timesheet.totalHours,
      billableHours: timesheet.entries.reduce((sum: number, entry: any) => sum + entry.billableHours, 0),
      nonBillableHours: timesheet.entries.reduce((sum: number, entry: any) => sum + entry.nonBillableHours, 0),
      overtimeHours: timesheet.entries.reduce((sum: number, entry: any) => sum + entry.overtimeHours, 0),
      submittedAt: timesheet.submittedAt ? formatDate(timesheet.submittedAt, 'yyyy-MM-dd HH:mm') : '',
      approvedAt: timesheet.approvedAt ? formatDate(timesheet.approvedAt, 'yyyy-MM-dd HH:mm') : '',
      approverName: timesheet.approver ? timesheet.approver.name : ''
    }

    if (timesheet.entries.length === 0) {
      // Add a row even if no entries
      exportData.push({
        ...baseRow,
        entryDate: '',
        entryStartTime: '',
        entryEndTime: '',
        entryBreakDuration: 0,
        projectCode: '',
        projectName: '',
        taskDescription: '',
        entryBillableHours: 0,
        entryNonBillableHours: 0,
        entryOvertimeHours: 0
      })
    } else {
      // Add a row for each entry
      timesheet.entries.forEach((entry: any) => {
        exportData.push({
          ...baseRow,
          entryDate: formatDate(entry.date, 'yyyy-MM-dd'),
          entryStartTime: entry.startTime,
          entryEndTime: entry.endTime,
          entryBreakDuration: entry.breakDuration,
          projectCode: entry.project?.code || '',
          projectName: entry.project?.name || '',
          taskDescription: entry.taskDescription || '',
          entryBillableHours: entry.billableHours,
          entryNonBillableHours: entry.nonBillableHours,
          entryOvertimeHours: entry.overtimeHours
        })
      })
    }
  })

  return exportData
}

function generateCSV(data: ExportRow[], excelCompatible = false): string {
  const headers = [
    'Timesheet ID',
    'Employee Name',
    'Employee ID',
    'Department',
    'Period',
    'Status',
    'Total Hours',
    'Billable Hours',
    'Non-billable Hours',
    'Overtime Hours',
    'Submitted At',
    'Approved At',
    'Approver',
    'Entry Date',
    'Start Time',
    'End Time',
    'Break (min)',
    'Project Code',
    'Project Name',
    'Task Description',
    'Entry Billable Hours',
    'Entry Non-billable Hours',
    'Entry Overtime Hours'
  ]

  const csvRows = [headers.join(',')]

  data.forEach(row => {
    const values = [
      row.timesheetId,
      `"${row.employeeName}"`,
      row.employeeId,
      `"${row.department}"`,
      `"${row.timesheetPeriod}"`,
      row.status,
      row.totalHours.toFixed(2),
      row.billableHours.toFixed(2),
      row.nonBillableHours.toFixed(2),
      row.overtimeHours.toFixed(2),
      row.submittedAt,
      row.approvedAt,
      `"${row.approverName}"`,
      row.entryDate,
      row.entryStartTime,
      row.entryEndTime,
      row.entryBreakDuration.toString(),
      row.projectCode,
      `"${row.projectName}"`,
      `"${row.taskDescription.replace(/"/g, '""')}"`, // Escape quotes
      row.entryBillableHours.toFixed(2),
      row.entryNonBillableHours.toFixed(2),
      row.entryOvertimeHours.toFixed(2)
    ]

    csvRows.push(values.join(','))
  })

  let csv = csvRows.join('\n')

  // Add BOM for Excel compatibility if requested
  if (excelCompatible) {
    csv = '\uFEFF' + csv
  }

  return csv
}

// Alternative endpoint for summary export
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.id, {
      module: 'TIMESHEET',
      action: 'READ',
      resource: 'ALL'
    })
    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { timesheetIds, includeEntries = true, format = 'csv' } = body

    if (!timesheetIds || !Array.isArray(timesheetIds)) {
      return NextResponse.json({ error: 'Invalid timesheet IDs' }, { status: 400 })
    }

    const timesheets = await prisma.timesheet.findMany({
      where: {
        id: { in: timesheetIds }
      },
      include: {
        employee: {
          include: {
            department: true
          }
        },
        entries: includeEntries ? {
          include: {
            project: true
          }
        } : false,
        approver: true
      }
    })

    if (includeEntries) {
      const exportData = generateExportData(timesheets)
      const csv = generateCSV(exportData)
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="timesheets-${timesheetIds.length}-items-${formatDate(new Date(), 'yyyy-MM-dd')}.csv"`
        }
      })
    } else {
      // Summary export without individual entries
      const summaryData = generateSummaryExport(timesheets)
      const csv = generateSummaryCSV(summaryData)
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="timesheets-summary-${formatDate(new Date(), 'yyyy-MM-dd')}.csv"`
        }
      })
    }

  } catch (error) {
    console.error('Export POST API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateSummaryExport(timesheets: any[]) {
  return timesheets.map(timesheet => ({
    timesheetId: timesheet.id,
    employeeName: `${timesheet.employee.firstName} ${timesheet.employee.lastName}`,
    employeeId: timesheet.employee.employeeId,
    department: timesheet.employee.department?.name || 'N/A',
    period: `${formatDate(timesheet.startDate, 'MMM dd')} - ${formatDate(timesheet.endDate, 'MMM dd, yyyy')}`,
    status: timesheet.status,
    totalHours: timesheet.totalHours,
    billableHours: timesheet.entries.reduce((sum: number, entry: any) => sum + entry.billableHours, 0),
    nonBillableHours: timesheet.entries.reduce((sum: number, entry: any) => sum + entry.nonBillableHours, 0),
    overtimeHours: timesheet.entries.reduce((sum: number, entry: any) => sum + entry.overtimeHours, 0),
    entryCount: timesheet.entries.length,
    submittedAt: timesheet.submittedAt ? formatDate(timesheet.submittedAt, 'yyyy-MM-dd HH:mm') : '',
    approvedAt: timesheet.approvedAt ? formatDate(timesheet.approvedAt, 'yyyy-MM-dd HH:mm') : '',
    approverName: timesheet.approver ? timesheet.approver.name : ''
  }))
}

function generateSummaryCSV(data: any[]): string {
  const headers = [
    'Timesheet ID',
    'Employee Name',
    'Employee ID',
    'Department',
    'Period',
    'Status',
    'Total Hours',
    'Billable Hours',
    'Non-billable Hours',
    'Overtime Hours',
    'Entry Count',
    'Submitted At',
    'Approved At',
    'Approver'
  ]

  const csvRows = [headers.join(',')]

  data.forEach(row => {
    const values = [
      row.timesheetId,
      `"${row.employeeName}"`,
      row.employeeId,
      `"${row.department}"`,
      `"${row.period}"`,
      row.status,
      row.totalHours.toFixed(2),
      row.billableHours.toFixed(2),
      row.nonBillableHours.toFixed(2),
      row.overtimeHours.toFixed(2),
      row.entryCount.toString(),
      row.submittedAt,
      row.approvedAt,
      `"${row.approverName}"`
    ]

    csvRows.push(values.join(','))
  })

  return csvRows.join('\n')
}

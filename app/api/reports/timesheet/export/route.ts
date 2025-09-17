import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission } from '@/lib/permissions'

const ExportQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.string().optional(),
  employeeId: z.string().optional(),
  reportType: z.enum(['personal', 'team', 'project']).default('personal'),
  format: z.enum(['csv', 'pdf']).default('csv'),
})

// GET /api/reports/timesheet/export - Export timesheet reports
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    const validatedParams = ExportQuerySchema.parse(queryParams)
    const { startDate, endDate, projectId, employeeId, reportType, format } = validatedParams

    // Check permissions based on report type
    if (reportType === 'team') {
      const canViewTeam = await checkPermission(session.user.id, {
        module: 'TIMESHEET',
        action: 'READ',
        resource: 'TEAM'
      })

      if (!canViewTeam.allowed) {
        return NextResponse.json({ error: 'Insufficient permissions for team reports' }, { status: 403 })
      }
    }

    // Build where clause for time entries
    const whereClause: any = {
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      },
      timesheet: {
        status: 'APPROVED'
      }
    }

    if (reportType === 'personal' || employeeId) {
      whereClause.timesheet.employeeId = employeeId || session.user.id
    }

    if (projectId) {
      whereClause.projectId = projectId
    }

    // Fetch time entries
    const timeEntries = await prisma.timeEntry.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            name: true,
            code: true,
            clientName: true
          }
        },
        timesheet: {
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeCode: true
              }
            }
          }
        }
      },
      orderBy: [
        { date: 'asc' },
        { timesheet: { employee: { employeeCode: 'asc' } } }
      ]
    })

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Date',
        'Employee Name',
        'Employee Code',
        'Project Name',
        'Project Code',
        'Client Name',
        'Start Time',
        'End Time',
        'Break Duration (min)',
        'Billable Hours',
        'Non-Billable Hours',
        'Overtime Hours',
        'Total Hours',
        'Task Description'
      ]

      const csvRows = [
        headers.join(','),
        ...timeEntries.map(entry => [
          entry.date.toISOString().split('T')[0],
          `"${entry.timesheet.employee.firstName} ${entry.timesheet.employee.lastName}"`,
          entry.timesheet.employee.employeeCode,
          `"${entry.project?.name || 'No Project'}"`,
          entry.project?.code || 'N/A',
          `"${entry.project?.clientName || 'N/A'}"`,
          entry.startTime,
          entry.endTime,
          entry.breakDuration,
          entry.billableHours,
          entry.nonBillableHours,
          entry.overtimeHours,
          Number(entry.billableHours) + Number(entry.nonBillableHours) + Number(entry.overtimeHours),
          `"${entry.taskDescription || ''}"`
        ].join(','))
      ]

      const csvContent = csvRows.join('\n')
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="timesheet-report-${startDate}-to-${endDate}.csv"`
        }
      })
    }

    // For PDF format, return a simple text-based report for now
    // In a real implementation, you'd use a PDF library like puppeteer or jsPDF
    const reportContent = `
TIMESHEET REPORT
Period: ${startDate} to ${endDate}
Generated: ${new Date().toISOString()}

SUMMARY:
Total Entries: ${timeEntries.length}
Total Hours: ${timeEntries.reduce((sum, entry) => sum + Number(entry.billableHours) + Number(entry.nonBillableHours) + Number(entry.overtimeHours), 0).toFixed(2)}
Billable Hours: ${timeEntries.reduce((sum, entry) => sum + Number(entry.billableHours), 0).toFixed(2)}
Non-Billable Hours: ${timeEntries.reduce((sum, entry) => sum + Number(entry.nonBillableHours), 0).toFixed(2)}
Overtime Hours: ${timeEntries.reduce((sum, entry) => sum + Number(entry.overtimeHours), 0).toFixed(2)}

DETAILED ENTRIES:
${timeEntries.map(entry => `
Date: ${entry.date.toISOString().split('T')[0]}
Employee: ${entry.timesheet.employee.firstName} ${entry.timesheet.employee.lastName} (${entry.timesheet.employee.employeeCode})
Project: ${entry.project?.name || 'No Project'} (${entry.project?.code || 'N/A'})
Time: ${entry.startTime} - ${entry.endTime} (Break: ${entry.breakDuration}min)
Hours: ${entry.billableHours}h billable, ${entry.nonBillableHours}h non-billable, ${entry.overtimeHours}h overtime
Description: ${entry.taskDescription || 'No description'}
`).join('\n---\n')}
    `.trim()

    return new NextResponse(reportContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="timesheet-report-${startDate}-to-${endDate}.txt"`
      }
    })

  } catch (error) {
    console.error('Error exporting timesheet report:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkPermission } from '@/lib/permissions'

const ReportQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.string().optional(),
  employeeId: z.string().optional(),
  reportType: z.enum(['personal', 'team', 'project']).default('personal'),
})

// GET /api/reports/timesheet - Generate timesheet reports
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    const validatedParams = ReportQuerySchema.parse(queryParams)
    const { startDate, endDate, projectId, employeeId, reportType } = validatedParams

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
        status: 'APPROVED' // Only include approved timesheets in reports
      }
    }

    // Filter by employee for personal reports or specific employee
    if (reportType === 'personal' || employeeId) {
      whereClause.timesheet.employeeId = employeeId || session.user.id
    }

    // Filter by project if specified
    if (projectId) {
      whereClause.projectId = projectId
    }

    // Fetch time entries with related data
    const timeEntries = await prisma.timeEntry.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
            clientName: true
          }
        },
        timesheet: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true
              }
            }
          }
        }
      }
    })

    // Calculate totals
    const totalHours = timeEntries.reduce((sum, entry) => 
      sum + Number(entry.billableHours) + Number(entry.nonBillableHours) + Number(entry.overtimeHours), 0
    )
    const billableHours = timeEntries.reduce((sum, entry) => sum + Number(entry.billableHours), 0)
    const nonBillableHours = timeEntries.reduce((sum, entry) => sum + Number(entry.nonBillableHours), 0)
    const overtimeHours = timeEntries.reduce((sum, entry) => sum + Number(entry.overtimeHours), 0)

    // Project breakdown
    const projectMap = new Map()
    timeEntries.forEach(entry => {
      const projectKey = entry.projectId || 'no-project'
      const projectName = entry.project?.name || 'No Project'
      const projectCode = entry.project?.code || 'N/A'
      
      if (!projectMap.has(projectKey)) {
        projectMap.set(projectKey, {
          projectId: projectKey,
          projectName,
          projectCode,
          hours: 0
        })
      }
      
      const project = projectMap.get(projectKey)
      project.hours += Number(entry.billableHours) + Number(entry.nonBillableHours) + Number(entry.overtimeHours)
    })

    const projectBreakdown = Array.from(projectMap.values()).map(project => ({
      ...project,
      percentage: totalHours > 0 ? (project.hours / totalHours) * 100 : 0
    })).sort((a, b) => b.hours - a.hours)

    // Daily breakdown
    const dailyMap = new Map()
    timeEntries.forEach(entry => {
      const dateKey = entry.date.toISOString().split('T')[0]
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          hours: 0,
          billableHours: 0,
          nonBillableHours: 0,
          overtimeHours: 0
        })
      }
      
      const day = dailyMap.get(dateKey)
      day.hours += Number(entry.billableHours) + Number(entry.nonBillableHours) + Number(entry.overtimeHours)
      day.billableHours += Number(entry.billableHours)
      day.nonBillableHours += Number(entry.nonBillableHours)
      day.overtimeHours += Number(entry.overtimeHours)
    })

    const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Employee breakdown (for team reports)
    let employeeBreakdown = undefined
    if (reportType === 'team') {
      const employeeMap = new Map()
      timeEntries.forEach(entry => {
        const employeeId = entry.timesheet.employee.id
        const employeeName = `${entry.timesheet.employee.firstName} ${entry.timesheet.employee.lastName}`
        const employeeCode = entry.timesheet.employee.employeeCode
        
        if (!employeeMap.has(employeeId)) {
          employeeMap.set(employeeId, {
            employeeId,
            employeeName,
            employeeCode,
            totalHours: 0,
            billableHours: 0
          })
        }
        
        const employee = employeeMap.get(employeeId)
        employee.totalHours += Number(entry.billableHours) + Number(entry.nonBillableHours) + Number(entry.overtimeHours)
        employee.billableHours += Number(entry.billableHours)
      })

      employeeBreakdown = Array.from(employeeMap.values()).map(employee => ({
        ...employee,
        utilizationRate: employee.totalHours > 0 ? (employee.billableHours / employee.totalHours) * 100 : 0
      })).sort((a, b) => b.totalHours - a.totalHours)
    }

    const reportData = {
      totalHours,
      billableHours,
      nonBillableHours,
      overtimeHours,
      projectBreakdown,
      dailyBreakdown,
      employeeBreakdown
    }

    return NextResponse.json(reportData)

  } catch (error) {
    console.error('Error generating timesheet report:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
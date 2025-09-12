import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, checkPermission } from '@/lib/auth'
import { z } from 'zod'
import { format, parseISO, startOfWeek, endOfWeek, subYears, eachDayOfInterval } from 'date-fns'

const AnalyticsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  viewType: z.enum(['overview', 'team', 'projects']).optional().default('overview'),
  employeeId: z.string().optional(),
  projectId: z.string().optional(),
  departmentId: z.string().optional()
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
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      viewType: searchParams.get('viewType') || 'overview',
      employeeId: searchParams.get('employeeId'),
      projectId: searchParams.get('projectId'),
      departmentId: searchParams.get('departmentId')
    }

    const validatedParams = AnalyticsQuerySchema.parse(queryParams)
    const { startDate, endDate, viewType, employeeId, projectId, departmentId } = validatedParams

    // Build base filter conditions
    const baseFilter = {
      startDate: { gte: parseISO(startDate) },
      endDate: { lte: parseISO(endDate) },
      ...(employeeId && { employeeId }),
      ...(departmentId && { employee: { departmentId } })
    }

    // Get timesheets with entries
    const timesheets = await prisma.timesheet.findMany({
      where: baseFilter,
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
        }
      }
    })

    // Calculate summary statistics
    const summary = calculateSummary(timesheets)

    // Generate trends data (daily breakdown)
    const trends = generateTrendsData(timesheets, startDate, endDate)

    // Calculate project utilization
    const projectUtilization = calculateProjectUtilization(timesheets)

    // Calculate employee productivity (if user has permission)
    const employeeProductivity = viewType !== 'overview' 
      ? calculateEmployeeProductivity(timesheets)
      : []

    // Calculate status distribution
    const statusDistribution = calculateStatusDistribution(timesheets)

    // Generate weekly comparison (year over year)
    const weeklyComparison = await generateWeeklyComparison(
      parseISO(startDate), 
      parseISO(endDate), 
      baseFilter
    )

    return NextResponse.json({
      summary,
      trends,
      projectUtilization,
      employeeProductivity,
      statusDistribution,
      weeklyComparison
    })

  } catch (error) {
    console.error('Analytics API error:', error)
    
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

function calculateSummary(timesheets: any[]) {
  const allEntries = timesheets.flatMap(ts => ts.entries)
  
  const totalHours = allEntries.reduce((sum, entry) => 
    sum + entry.billableHours + entry.nonBillableHours + entry.overtimeHours, 0
  )
  
  const billableHours = allEntries.reduce((sum, entry) => sum + entry.billableHours, 0)
  const nonBillableHours = allEntries.reduce((sum, entry) => sum + entry.nonBillableHours, 0)
  const overtimeHours = allEntries.reduce((sum, entry) => sum + entry.overtimeHours, 0)
  
  const uniqueProjects = new Set(allEntries.map(entry => entry.projectId).filter(Boolean))
  const uniqueEmployees = new Set(timesheets.map(ts => ts.employeeId))
  
  // Calculate working days in the period
  const workingDays = timesheets.length > 0 
    ? Math.max(1, new Set(allEntries.map(entry => entry.date.toISOString().split('T')[0])).size)
    : 1

  return {
    totalHours: totalHours,
    billableHours: billableHours,
    nonBillableHours: nonBillableHours,
    overtimeHours: overtimeHours,
    utilizationRate: totalHours > 0 ? (billableHours / totalHours) * 100 : 0,
    averageHoursPerDay: totalHours / workingDays,
    totalProjects: uniqueProjects.size,
    activeEmployees: uniqueEmployees.size
  }
}

function generateTrendsData(timesheets: any[], startDate: string, endDate: string) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const days = eachDayOfInterval({ start, end })
  
  return days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const dayEntries = timesheets
      .flatMap(ts => ts.entries)
      .filter(entry => format(entry.date, 'yyyy-MM-dd') === dayStr)
    
    return {
      date: format(day, 'MMM dd'),
      totalHours: dayEntries.reduce((sum, entry) => 
        sum + entry.billableHours + entry.nonBillableHours + entry.overtimeHours, 0
      ),
      billableHours: dayEntries.reduce((sum, entry) => sum + entry.billableHours, 0),
      nonBillableHours: dayEntries.reduce((sum, entry) => sum + entry.nonBillableHours, 0),
      overtimeHours: dayEntries.reduce((sum, entry) => sum + entry.overtimeHours, 0)
    }
  })
}

function calculateProjectUtilization(timesheets: any[]) {
  const projectMap = new Map()
  
  timesheets.forEach(ts => {
    ts.entries.forEach((entry: any) => {
      if (!entry.project) return
      
      const projectId = entry.project.id
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          projectName: entry.project.name,
          projectCode: entry.project.code,
          totalHours: 0,
          billableHours: 0,
          employees: new Set()
        })
      }
      
      const project = projectMap.get(projectId)
      project.totalHours += entry.billableHours + entry.nonBillableHours + entry.overtimeHours
      project.billableHours += entry.billableHours
      project.employees.add(ts.employeeId)
    })
  })
  
  return Array.from(projectMap.values()).map(project => ({
    projectName: project.projectName,
    projectCode: project.projectCode,
    totalHours: project.totalHours,
    billableHours: project.billableHours,
    utilizationRate: project.totalHours > 0 ? (project.billableHours / project.totalHours) * 100 : 0,
    employeeCount: project.employees.size
  })).sort((a, b) => b.totalHours - a.totalHours)
}

function calculateEmployeeProductivity(timesheets: any[]) {
  const employeeMap = new Map()
  
  timesheets.forEach(ts => {
    const employeeId = ts.employee.id
    if (!employeeMap.has(employeeId)) {
      employeeMap.set(employeeId, {
        employeeName: `${ts.employee.firstName} ${ts.employee.lastName}`,
        employeeId: ts.employee.employeeId,
        totalHours: 0,
        billableHours: 0,
        projects: new Set()
      })
    }
    
    const employee = employeeMap.get(employeeId)
    ts.entries.forEach((entry: any) => {
      employee.totalHours += entry.billableHours + entry.nonBillableHours + entry.overtimeHours
      employee.billableHours += entry.billableHours
      if (entry.projectId) {
        employee.projects.add(entry.projectId)
      }
    })
  })
  
  return Array.from(employeeMap.values()).map(employee => ({
    employeeName: employee.employeeName,
    employeeId: employee.employeeId,
    totalHours: employee.totalHours,
    billableHours: employee.billableHours,
    utilizationRate: employee.totalHours > 0 ? (employee.billableHours / employee.totalHours) * 100 : 0,
    projectCount: employee.projects.size
  })).sort((a, b) => b.totalHours - a.totalHours)
}

function calculateStatusDistribution(timesheets: any[]) {
  const statusCounts = timesheets.reduce((acc, ts) => {
    acc[ts.status] = (acc[ts.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const total = timesheets.length
  
  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count: count as number,
    percentage: total > 0 ? ((count as number) / total) * 100 : 0
  }))
}

async function generateWeeklyComparison(
  startDate: Date, 
  endDate: Date, 
  baseFilter: any
) {
  try {
    // Get data for previous year
    const previousYearStart = subYears(startDate, 1)
    const previousYearEnd = subYears(endDate, 1)
    
    const previousYearFilter = {
      ...baseFilter,
      startDate: { gte: previousYearStart },
      endDate: { lte: previousYearEnd }
    }
    
    const [currentYearTimesheets, previousYearTimesheets] = await Promise.all([
      prisma.timesheet.findMany({
        where: baseFilter,
        include: { entries: true }
      }),
      prisma.timesheet.findMany({
        where: previousYearFilter,
        include: { entries: true }
      })
    ])
    
    // Group by week
    const currentYearWeeks = groupByWeek(currentYearTimesheets)
    const previousYearWeeks = groupByWeek(previousYearTimesheets)
    
    // Combine data
    const allWeeks = new Set([
      ...Object.keys(currentYearWeeks),
      ...Object.keys(previousYearWeeks)
    ])
    
    return Array.from(allWeeks).sort().map(week => ({
      week,
      currentYear: currentYearWeeks[week] || 0,
      previousYear: previousYearWeeks[week] || 0
    }))
    
  } catch (error) {
    console.error('Error generating weekly comparison:', error)
    return []
  }
}

function groupByWeek(timesheets: any[]) {
  const weekMap: Record<string, number> = {}
  
  timesheets.forEach(ts => {
    const weekStart = startOfWeek(ts.startDate, { weekStartsOn: 1 })
    const weekKey = format(weekStart, 'MMM dd')
    
    const totalHours = ts.entries.reduce((sum: number, entry: any) => 
      sum + entry.billableHours + entry.nonBillableHours + entry.overtimeHours, 0
    )
    
    weekMap[weekKey] = (weekMap[weekKey] || 0) + totalHours
  })
  
  return weekMap
}

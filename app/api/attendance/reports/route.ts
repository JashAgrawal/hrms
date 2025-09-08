import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { startOfMonth, endOfMonth, format, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns'

// Schema for report queries
const reportQuerySchema = z.object({
  type: z.enum(['summary', 'detailed', 'overtime', 'trends']),
  period: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  employeeId: z.string().optional(),
  departmentId: z.string().optional(),
  format: z.enum(['json', 'csv']).default('json'),
})

// GET /api/attendance/reports - Generate attendance reports
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = reportQuerySchema.parse(Object.fromEntries(searchParams))

    // Get user's employee record and check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    // Check permissions for accessing reports
    const canViewAllReports = ['HR', 'ADMIN', 'MANAGER'].includes(user.role)
    
    // Determine date range
    let startDate: Date
    let endDate: Date

    if (query.period === 'custom' && query.startDate && query.endDate) {
      startDate = new Date(query.startDate)
      endDate = new Date(query.endDate)
    } else {
      const now = new Date()
      switch (query.period) {
        case 'daily':
          startDate = new Date(now)
          startDate.setHours(0, 0, 0, 0)
          endDate = new Date(now)
          endDate.setHours(23, 59, 59, 999)
          break
        case 'weekly':
          startDate = startOfWeek(now)
          endDate = endOfWeek(now)
          break
        case 'monthly':
        default:
          startDate = startOfMonth(now)
          endDate = endOfMonth(now)
          break
      }
    }

    // Build where clause based on permissions and filters
    const whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate
      }
    }

    // Apply employee filter
    if (query.employeeId) {
      if (!canViewAllReports && query.employeeId !== user.employee.id) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      whereClause.employeeId = query.employeeId
    } else if (!canViewAllReports) {
      // Employees can only see their own records
      whereClause.employeeId = user.employee.id
    }

    // Apply department filter for managers
    if (query.departmentId && canViewAllReports) {
      whereClause.employee = {
        departmentId: query.departmentId
      }
    } else if (user.role === 'MANAGER' && !query.employeeId) {
      // Managers can see their team's records
      whereClause.employee = {
        reportingTo: user.employee.id
      }
    }

    // Generate report based on type
    let reportData: any

    switch (query.type) {
      case 'summary':
        reportData = await generateSummaryReport(whereClause, startDate, endDate)
        break
      case 'detailed':
        reportData = await generateDetailedReport(whereClause)
        break
      case 'overtime':
        reportData = await generateOvertimeReport(whereClause)
        break
      case 'trends':
        reportData = await generateTrendsReport(whereClause, startDate, endDate)
        break
      default:
        reportData = await generateSummaryReport(whereClause, startDate, endDate)
    }

    // Return CSV format if requested
    if (query.format === 'csv') {
      const csv = convertToCSV(reportData, query.type)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="attendance-report-${format(new Date(), 'yyyy-MM-dd')}.csv"`
        }
      })
    }

    return NextResponse.json({
      success: true,
      reportType: query.type,
      period: query.period,
      dateRange: {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd')
      },
      data: reportData
    })

  } catch (error) {
    console.error('Error generating attendance report:', error)
    return NextResponse.json(
      { error: 'Failed to generate attendance report' },
      { status: 500 }
    )
  }
}

// Generate summary report
async function generateSummaryReport(whereClause: any, startDate: Date, endDate: Date) {
  const records = await prisma.attendanceRecord.findMany({
    where: whereClause,
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          designation: true,
          department: {
            select: { name: true }
          }
        }
      }
    }
  })

  // Group by employee
  const employeeStats = records.reduce((acc: any, record) => {
    const empId = record.employeeId
    if (!acc[empId]) {
      acc[empId] = {
        employee: record.employee,
        totalDays: 0,
        presentDays: 0,
        lateDays: 0,
        absentDays: 0,
        halfDays: 0,
        totalHours: 0,
        totalOvertime: 0,
        attendanceRate: 0
      }
    }

    acc[empId].totalDays++
    
    if (['PRESENT', 'LATE', 'WORK_FROM_HOME'].includes(record.status)) {
      acc[empId].presentDays++
    }
    
    if (record.status === 'LATE') acc[empId].lateDays++
    if (record.status === 'ABSENT') acc[empId].absentDays++
    if (record.status === 'HALF_DAY') acc[empId].halfDays++
    
    acc[empId].totalHours += Number(record.workHours || 0)
    acc[empId].totalOvertime += Number(record.overtime || 0)
    
    return acc
  }, {})

  // Calculate attendance rates
  Object.values(employeeStats).forEach((stats: any) => {
    stats.attendanceRate = stats.totalDays > 0 ? 
      Math.round((stats.presentDays / stats.totalDays) * 100) : 0
    stats.averageHours = stats.presentDays > 0 ? 
      Math.round((stats.totalHours / stats.presentDays) * 100) / 100 : 0
  })

  // Calculate working days in period
  const workingDays = eachDayOfInterval({ start: startDate, end: endDate })
    .filter(date => date.getDay() !== 0 && date.getDay() !== 6).length

  return {
    summary: {
      totalEmployees: Object.keys(employeeStats).length,
      workingDays,
      averageAttendanceRate: Object.values(employeeStats).reduce((sum: number, stats: any) => 
        sum + stats.attendanceRate, 0) / Object.keys(employeeStats).length || 0,
      totalWorkHours: Object.values(employeeStats).reduce((sum: number, stats: any) => 
        sum + stats.totalHours, 0),
      totalOvertime: Object.values(employeeStats).reduce((sum: number, stats: any) => 
        sum + stats.totalOvertime, 0)
    },
    employeeStats: Object.values(employeeStats)
  }
}

// Generate detailed report
async function generateDetailedReport(whereClause: any) {
  const records = await prisma.attendanceRecord.findMany({
    where: whereClause,
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          designation: true,
          department: {
            select: { name: true }
          }
        }
      },
      checkInOut: {
        orderBy: { timestamp: 'asc' }
      }
    },
    orderBy: [
      { employee: { firstName: 'asc' } },
      { date: 'desc' }
    ]
  })

  return {
    records: records.map(record => ({
      ...record,
      workHours: Number(record.workHours || 0),
      overtime: Number(record.overtime || 0)
    }))
  }
}

// Generate overtime report
async function generateOvertimeReport(whereClause: any) {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      ...whereClause,
      overtime: {
        gt: 0
      }
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          designation: true,
          department: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: [
      { overtime: 'desc' },
      { date: 'desc' }
    ]
  })

  const overtimeStats = records.reduce((acc: any, record) => {
    const empId = record.employeeId
    if (!acc[empId]) {
      acc[empId] = {
        employee: record.employee,
        totalOvertimeDays: 0,
        totalOvertimeHours: 0,
        maxOvertimeDay: 0,
        records: []
      }
    }

    acc[empId].totalOvertimeDays++
    acc[empId].totalOvertimeHours += Number(record.overtime || 0)
    acc[empId].maxOvertimeDay = Math.max(acc[empId].maxOvertimeDay, Number(record.overtime || 0))
    acc[empId].records.push(record)

    return acc
  }, {})

  return {
    summary: {
      totalOvertimeHours: records.reduce((sum, r) => sum + Number(r.overtime || 0), 0),
      totalOvertimeDays: records.length,
      employeesWithOvertime: Object.keys(overtimeStats).length
    },
    employeeOvertimeStats: Object.values(overtimeStats),
    detailedRecords: records
  }
}

// Generate trends report
async function generateTrendsReport(whereClause: any, startDate: Date, endDate: Date) {
  const records = await prisma.attendanceRecord.findMany({
    where: whereClause,
    orderBy: { date: 'asc' }
  })

  // Group by date
  const dailyStats = records.reduce((acc: any, record) => {
    const dateKey = format(record.date, 'yyyy-MM-dd')
    if (!acc[dateKey]) {
      acc[dateKey] = {
        date: dateKey,
        totalEmployees: 0,
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        workFromHome: 0,
        totalHours: 0,
        totalOvertime: 0
      }
    }

    acc[dateKey].totalEmployees++
    acc[dateKey][record.status.toLowerCase().replace('_', '')] = 
      (acc[dateKey][record.status.toLowerCase().replace('_', '')] || 0) + 1
    acc[dateKey].totalHours += Number(record.workHours || 0)
    acc[dateKey].totalOvertime += Number(record.overtime || 0)

    return acc
  }, {})

  // Calculate attendance rates for each day
  Object.values(dailyStats).forEach((day: any) => {
    day.attendanceRate = day.totalEmployees > 0 ? 
      Math.round(((day.present + day.late + day.workfromhome) / day.totalEmployees) * 100) : 0
    day.averageHours = (day.present + day.late + day.workfromhome) > 0 ? 
      Math.round((day.totalHours / (day.present + day.late + day.workfromhome)) * 100) / 100 : 0
  })

  return {
    dailyTrends: Object.values(dailyStats),
    periodSummary: {
      averageAttendanceRate: Object.values(dailyStats).reduce((sum: number, day: any) => 
        sum + day.attendanceRate, 0) / Object.keys(dailyStats).length || 0,
      totalWorkingDays: Object.keys(dailyStats).length,
      peakAttendanceDay: Object.values(dailyStats).reduce((max: any, day: any) => 
        day.attendanceRate > (max?.attendanceRate || 0) ? day : max, null),
      lowestAttendanceDay: Object.values(dailyStats).reduce((min: any, day: any) => 
        day.attendanceRate < (min?.attendanceRate || 100) ? day : min, null)
    }
  }
}

// Convert report data to CSV format
function convertToCSV(data: any, reportType: string): string {
  let headers: string[] = []
  let rows: any[] = []

  switch (reportType) {
    case 'summary':
      headers = ['Employee Code', 'Name', 'Department', 'Total Days', 'Present Days', 'Late Days', 'Absent Days', 'Attendance Rate %', 'Total Hours', 'Total Overtime']
      rows = data.employeeStats.map((emp: any) => [
        emp.employee.employeeCode,
        `${emp.employee.firstName} ${emp.employee.lastName}`,
        emp.employee.department.name,
        emp.totalDays,
        emp.presentDays,
        emp.lateDays,
        emp.absentDays,
        emp.attendanceRate,
        emp.totalHours,
        emp.totalOvertime
      ])
      break
    case 'detailed':
      headers = ['Date', 'Employee Code', 'Name', 'Check In', 'Check Out', 'Status', 'Work Hours', 'Overtime', 'Method']
      rows = data.records.map((record: any) => [
        format(new Date(record.date), 'yyyy-MM-dd'),
        record.employee.employeeCode,
        `${record.employee.firstName} ${record.employee.lastName}`,
        record.checkIn ? format(new Date(record.checkIn), 'HH:mm:ss') : '-',
        record.checkOut ? format(new Date(record.checkOut), 'HH:mm:ss') : '-',
        record.status,
        record.workHours || 0,
        record.overtime || 0,
        record.method
      ])
      break
    default:
      headers = ['Data']
      rows = [['Report data not available in CSV format']]
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}
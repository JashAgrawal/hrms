import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/employee/stats - Get employee dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's employee record
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        employee: {
          include: {
            department: true
          }
        }
      }
    })

    if (!currentUser?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const employeeId = currentUser.employee.id
    const currentDate = new Date()
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    const currentYear = currentDate.getFullYear()

    // Calculate attendance rate for current month
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: {
          gte: currentMonth,
          lt: nextMonth
        }
      }
    })

    const totalWorkingDays = attendanceRecords.length
    const presentDays = attendanceRecords.filter(record =>
      ['PRESENT', 'LATE', 'EARLY_DEPARTURE'].includes(record.status)
    ).length
    const attendanceRate = totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0

    // Get leave balance (total remaining days across all policies)
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: {
        employeeId,
        year: currentYear
      },
      include: {
        policy: true
      }
    })

    const totalLeaveBalance = leaveBalances.reduce((sum, balance) => sum + Number(balance.available), 0)

    // Get pending expenses count
    const pendingExpenses = await prisma.expenseClaim.count({
      where: {
        employeeId,
        status: 'PENDING'
      }
    })

    // Get last salary from most recent payroll record
    const lastPayrollRecord = await prisma.payrollRecord.findFirst({
      where: {
        employeeId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const lastSalary = lastPayrollRecord ? Number(lastPayrollRecord.netSalary) : Number(currentUser.employee.basicSalary || 0)

    // Get performance rating from most recent review
    const lastPerformanceReview = await prisma.performanceReview.findFirst({
      where: {
        employeeId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const performanceRating = lastPerformanceReview ? Number(lastPerformanceReview.overallRating || 0) : 0

    // Get documents to submit (pending onboarding tasks)
    const documentsToSubmit = await prisma.onboardingWorkflowTask.count({
      where: {
        workflow: {
          employeeId
        },
        status: 'PENDING',
        task: {
          category: 'DOCUMENTS'
        }
      }
    })

    const stats = {
      attendanceRate: Math.round(attendanceRate * 10) / 10, // Round to 1 decimal place
      leaveBalance: totalLeaveBalance,
      pendingExpenses,
      lastSalary,
      performanceRating,
      documentsToSubmit
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching employee dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}
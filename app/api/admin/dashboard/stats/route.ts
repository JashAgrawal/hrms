import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/dashboard/stats - Get admin dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin can view dashboard stats
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

    // Get employee statistics
    const [
      totalEmployees,
      activeEmployees,
      pendingOnboarding,
      pendingLeaveRequests,
      pendingAttendanceRequests,
      pendingExpenseClaims,
      currentMonthAttendance,
      currentMonthPayroll
    ] = await Promise.all([
      // Total employees
      prisma.employee.count(),
      
      // Active employees
      prisma.employee.count({
        where: { status: "ACTIVE" }
      }),
      
      // Pending onboarding
      prisma.onboardingWorkflow.count({
        where: { status: { in: ["PENDING", "IN_PROGRESS"] } }
      }),
      
      // Pending leave requests
      prisma.leaveRequest.count({
        where: { status: "PENDING" }
      }),
      
      // Pending attendance requests
      prisma.attendanceRequest.count({
        where: { status: "PENDING" }
      }),
      
      // Pending expense claims
      prisma.expenseClaim.count({
        where: { status: "PENDING" }
      }),
      
      // Current month attendance records
      prisma.attendanceRecord.findMany({
        where: {
          date: {
            gte: currentMonth,
            lt: nextMonth,
          }
        },
        select: {
          status: true,
          employeeId: true,
        }
      }),
      
      // Current month payroll
      prisma.payrollRecord.aggregate({
        where: {
          payrollRun: {
            startDate: {
              gte: currentMonth,
              lt: nextMonth,
            }
          }
        },
        _sum: {
          grossSalary: true,
        }
      })
    ]);

    // Calculate attendance rate
    let attendanceRate = 0;
    if (currentMonthAttendance.length > 0) {
      const presentRecords = currentMonthAttendance.filter(
        record => record.status === "PRESENT" || record.status === "WORK_FROM_HOME"
      ).length;
      attendanceRate = (presentRecords / currentMonthAttendance.length) * 100;
    }

    // Get recent system metrics
    const [
      recentLogins,
      systemErrors,
      activeLocations
    ] = await Promise.all([
      // Recent logins (last 24 hours)
      prisma.auditLog.count({
        where: {
          action: "LOGIN",
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // System errors (last 24 hours) - you might track these differently
      prisma.auditLog.count({
        where: {
          action: { contains: "ERROR" },
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Active locations
      prisma.location.count({
        where: { isActive: true }
      })
    ]);

    const stats = {
      totalEmployees,
      activeEmployees,
      pendingOnboarding,
      monthlyPayroll: Number(currentMonthPayroll._sum.grossSalary || 0),
      attendanceRate,
      leaveRequests: pendingLeaveRequests,
      attendanceRequests: pendingAttendanceRequests,
      expenseClaims: pendingExpenseClaims,
      systemMetrics: {
        recentLogins,
        systemErrors,
        activeLocations,
        databasePerformance: 98.5, // This would come from actual monitoring
        activeSessions: recentLogins, // Simplified - you might track this differently
      }
    };

    // Log the dashboard access
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "VIEW_ADMIN_DASHBOARD",
        resource: "DASHBOARD",
        newValues: {
          statsRequested: true,
          timestamp: new Date().toISOString(),
        },
        ipAddress: request.headers.get("x-forwarded-for") || 
                   request.headers.get("x-real-ip") || 
                   "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      }
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching admin dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}
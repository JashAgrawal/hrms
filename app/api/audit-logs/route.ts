import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/audit-logs - Get audit logs (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin can view audit logs
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions. Only admins can view audit logs." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const action = searchParams.get("action");
    const resource = searchParams.get("resource");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;

    // Build where clause
    let whereClause: any = {};

    if (action) {
      whereClause.action = { contains: action, mode: "insensitive" };
    }

    if (resource) {
      whereClause.resource = { contains: resource, mode: "insensitive" };
    }

    if (userId) {
      whereClause.userId = userId;
    }

    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) {
        whereClause.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.timestamp.lte = new Date(endDate);
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.auditLog.count({ where: whereClause });

    // Get audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            employee: {
              select: {
                employeeCode: true,
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      },
      orderBy: { timestamp: "desc" },
      skip,
      take: limit,
    });

    // Format the response
    const formattedLogs = auditLogs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      user: log.user ? {
        id: log.user.id,
        name: log.user.name,
        email: log.user.email,
        role: log.user.role,
        employeeCode: log.user.employee?.employeeCode,
        employeeName: log.user.employee 
          ? `${log.user.employee.firstName} ${log.user.employee.lastName}`
          : null,
      } : null,
      oldValues: log.oldValues,
      newValues: log.newValues,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
    }));

    // Log this audit log access
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "VIEW_AUDIT_LOGS",
        resource: "AUDIT_LOGS",
        newValues: {
          page,
          limit,
          totalCount,
          filters: {
            action,
            resource,
            userId,
            startDate,
            endDate,
          }
        },
        ipAddress: request.headers.get("x-forwarded-for") || 
                   request.headers.get("x-real-ip") || 
                   "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      }
    });

    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: skip + limit < totalCount,
        hasPrev: page > 1,
      }
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}

// GET /api/audit-logs/stats - Get audit log statistics (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin can view audit log stats
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get action statistics
    const actionStats = await prisma.auditLog.groupBy({
      by: ["action"],
      where: {
        timestamp: { gte: startDate }
      },
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
      take: 10,
    });

    // Get resource statistics
    const resourceStats = await prisma.auditLog.groupBy({
      by: ["resource"],
      where: {
        timestamp: { gte: startDate }
      },
      _count: { resource: true },
      orderBy: { _count: { resource: "desc" } },
      take: 10,
    });

    // Get user activity statistics
    const userStats = await prisma.auditLog.groupBy({
      by: ["userId"],
      where: {
        timestamp: { gte: startDate },
        userId: { not: null }
      },
      _count: { userId: true },
      orderBy: { _count: { userId: "desc" } },
      take: 10,
    });

    // Get user details for user stats
    const userIds = userStats.map(stat => stat.userId).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    const userMap = new Map(users.map(user => [user.id, user]));

    const formattedUserStats = userStats.map(stat => ({
      userId: stat.userId,
      count: stat._count.userId,
      user: stat.userId ? userMap.get(stat.userId) : null,
    }));

    // Get daily activity for the last 7 days
    const dailyStats = await prisma.$queryRaw`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM audit_logs 
      WHERE timestamp >= ${startDate}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 7
    ` as Array<{ date: Date; count: bigint }>;

    return NextResponse.json({
      period: `Last ${days} days`,
      actionStats: actionStats.map(stat => ({
        action: stat.action,
        count: stat._count.action,
      })),
      resourceStats: resourceStats.map(stat => ({
        resource: stat.resource,
        count: stat._count.resource,
      })),
      userStats: formattedUserStats,
      dailyStats: dailyStats.map(stat => ({
        date: stat.date,
        count: Number(stat.count),
      })),
    });
  } catch (error) {
    console.error("Error fetching audit log stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log statistics" },
      { status: 500 }
    );
  }
}
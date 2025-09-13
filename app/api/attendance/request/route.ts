import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailService } from "@/lib/email-service";
import { z } from "zod";

const createAttendanceRequestSchema = z.object({
  date: z.string().transform(str => new Date(str)),
  checkInTime: z.string().transform(str => new Date(str)),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional(),
  }),
  reason: z.string().min(10, "Please provide a detailed reason (minimum 10 characters)"),
});

// GET /api/attendance/request - Get attendance requests (for managers/HR)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";
    const employeeId = searchParams.get("employeeId");

    const whereClause: any = { status };

    // If not admin/HR, only show requests for employees they manage
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      const managedEmployees = await prisma.employee.findMany({
        where: { reportingTo: session.user.id },
        select: { id: true }
      });

      if (managedEmployees.length === 0) {
        return NextResponse.json({ requests: [] });
      }

      whereClause.employeeId = {
        in: managedEmployees.map(emp => emp.id)
      };
    }

    if (employeeId && ["ADMIN", "HR"].includes(session.user.role)) {
      whereClause.employeeId = employeeId;
    }

    const requests = await prisma.attendanceRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "VIEW",
        resource: "ATTENDANCE_REQUESTS",
        newValues: { 
          status,
          count: requests.length,
          employeeId: employeeId || null
        }
      }
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Error fetching attendance requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance requests" },
      { status: 500 }
    );
  }
}

// POST /api/attendance/request - Create attendance request for out-of-location check-in
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createAttendanceRequestSchema.parse(body);

    // Get employee info
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        reportingTo: true,
      }
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Check if there's already a request for this date
    const existingRequest = await prisma.attendanceRequest.findFirst({
      where: {
        employeeId: employee.id,
        date: validatedData.date,
        status: { in: ["PENDING", "APPROVED"] }
      }
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "An attendance request for this date already exists" },
        { status: 400 }
      );
    }

    // Create the attendance request
    const attendanceRequest = await prisma.attendanceRequest.create({
      data: {
        employeeId: employee.id,
        date: validatedData.date,
        checkInTime: validatedData.checkInTime,
        location: validatedData.location,
        reason: validatedData.reason,
        status: "PENDING",
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        resource: "ATTENDANCE_REQUEST",
        resourceId: attendanceRequest.id,
        newValues: {
          employeeName: `${employee.firstName} ${employee.lastName}`,
          date: validatedData.date.toISOString(),
          reason: validatedData.reason,
          location: validatedData.location,
        }
      }
    });

    // Send email notification to manager/HR
    try {
      let notificationSent = false;

      // First try to notify the reporting manager
      if (employee.reportingTo) {
        const manager = await prisma.employee.findUnique({
          where: { id: employee.reportingTo },
          include: { user: true }
        });

        if (manager?.user?.email) {
          await emailService.sendEmail({
            to: manager.user.email,
            subject: 'New Attendance Request for Approval',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #007bff;">📋 New Attendance Request</h2>
                <p>Hi ${manager.firstName},</p>
                <p>You have a new attendance request to review:</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p><strong>Employee:</strong> ${employee.firstName} ${employee.lastName} (${employee.employeeCode})</p>
                  <p><strong>Date:</strong> ${validatedData.date.toDateString()}</p>
                  <p><strong>Check-in Time:</strong> ${validatedData.checkInTime.toLocaleString()}</p>
                  <p><strong>Reason:</strong> ${validatedData.reason}</p>
                </div>
                <p>Please review and approve/reject this request in the HR system.</p>
                <p>Best regards,<br>HR System</p>
              </div>
            `,
            text: `Hi ${manager.firstName}, You have a new attendance request from ${employee.firstName} ${employee.lastName} for ${validatedData.date.toDateString()}. Reason: ${validatedData.reason}`
          });
          notificationSent = true;
        }
      }

      // If no manager or manager notification failed, notify HR
      if (!notificationSent) {
        const hrUsers = await prisma.user.findMany({
          where: {
            role: { in: ['HR', 'ADMIN'] },
            isActive: true
          },
          include: { employee: true }
        });

        for (const hrUser of hrUsers) {
          if (hrUser.email) {
            await emailService.sendEmail({
              to: hrUser.email,
              subject: 'New Attendance Request for Approval',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #007bff;">📋 New Attendance Request</h2>
                  <p>Hi ${hrUser.employee?.firstName || 'HR Team'},</p>
                  <p>A new attendance request requires approval:</p>
                  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p><strong>Employee:</strong> ${employee.firstName} ${employee.lastName} (${employee.employeeCode})</p>
                    <p><strong>Date:</strong> ${validatedData.date.toDateString()}</p>
                    <p><strong>Check-in Time:</strong> ${validatedData.checkInTime.toLocaleString()}</p>
                    <p><strong>Reason:</strong> ${validatedData.reason}</p>
                  </div>
                  <p>Please review and approve/reject this request in the HR system.</p>
                  <p>Best regards,<br>HR System</p>
                </div>
              `,
              text: `Hi ${hrUser.employee?.firstName || 'HR Team'}, New attendance request from ${employee.firstName} ${employee.lastName} for ${validatedData.date.toDateString()}. Reason: ${validatedData.reason}`
            });
          }
        }
      }
    } catch (error) {
      console.warn('Failed to send attendance request notification:', error);
    }

    return NextResponse.json({
      message: "Attendance request submitted successfully",
      request: attendanceRequest
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }
    
    console.error("Error creating attendance request:", error);
    return NextResponse.json(
      { error: "Failed to create attendance request" },
      { status: 500 }
    );
  }
}
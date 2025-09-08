import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const approveRequestSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  comments: z.string().optional(),
});

// POST /api/attendance/request/[id]/approve - Approve or reject attendance request
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestId = params.id;
    const body = await request.json();
    const { action, comments } = approveRequestSchema.parse(body);

    // Get the attendance request
    const attendanceRequest = await prisma.attendanceRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            reportingTo: true,
            userId: true,
          }
        }
      }
    });

    if (!attendanceRequest) {
      return NextResponse.json(
        { error: "Attendance request not found" },
        { status: 404 }
      );
    }

    if (attendanceRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "This request has already been processed" },
        { status: 400 }
      );
    }

    // Check permissions - admin, HR, or the employee's manager
    const canApprove = 
      ["ADMIN", "HR"].includes(session.user.role) ||
      attendanceRequest.employee.reportingTo === session.user.id;

    if (!canApprove) {
      return NextResponse.json(
        { error: "Insufficient permissions to approve this request" },
        { status: 403 }
      );
    }

    // Update the request status
    const updatedRequest = await prisma.attendanceRequest.update({
      where: { id: requestId },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        approvedBy: session.user.id,
        approvedAt: action === "APPROVE" ? new Date() : null,
        rejectedAt: action === "REJECT" ? new Date() : null,
        rejectionReason: action === "REJECT" ? comments : null,
      },
    });

    // If approved, create the attendance record
    if (action === "APPROVE") {
      const dateOnly = new Date(
        attendanceRequest.date.getFullYear(),
        attendanceRequest.date.getMonth(),
        attendanceRequest.date.getDate()
      );

      // Check if attendance record already exists
      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: attendanceRequest.employeeId,
            date: dateOnly,
          }
        }
      });

      if (!existingRecord) {
        // Create attendance record
        const attendanceRecord = await prisma.attendanceRecord.create({
          data: {
            employeeId: attendanceRequest.employeeId,
            date: dateOnly,
            checkIn: attendanceRequest.checkInTime,
            location: attendanceRequest.location,
            status: "PRESENT",
            method: "WEB",
            approvedBy: session.user.id,
            approvedAt: new Date(),
          }
        });

        // Create check-in record
        await prisma.checkInOut.create({
          data: {
            attendanceId: attendanceRecord.id,
            employeeId: attendanceRequest.employeeId,
            type: "CHECK_IN",
            timestamp: attendanceRequest.checkInTime,
            location: attendanceRequest.location,
            method: "WEB",
            isManualEntry: true,
            manualReason: `Approved out-of-location check-in: ${attendanceRequest.reason}`,
            approvedBy: session.user.id,
          }
        });
      }
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: action === "APPROVE" ? "APPROVE_ATTENDANCE_REQUEST" : "REJECT_ATTENDANCE_REQUEST",
        resource: "ATTENDANCE_REQUEST",
        resourceId: requestId,
        newValues: {
          employeeName: `${attendanceRequest.employee.firstName} ${attendanceRequest.employee.lastName}`,
          employeeCode: attendanceRequest.employee.employeeCode,
          date: attendanceRequest.date.toISOString(),
          action,
          comments: comments || null,
        }
      }
    });

    return NextResponse.json({
      message: `Attendance request ${action.toLowerCase()}d successfully`,
      request: updatedRequest
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }
    
    console.error("Error processing attendance request:", error);
    return NextResponse.json(
      { error: "Failed to process attendance request" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/locations/[id]/employees/[employeeId] - Remove employee from location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; employeeId: string }> }
) {
  const { id: locationId, employeeId } = await params
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and HR can remove employee assignments
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Find the assignment
    const assignment = await prisma.employeeLocation.findFirst({
      where: {
        locationId,
        employeeId,
        isActive: true,
      },
      include: {
        location: {
          select: { name: true }
        },
        employee: {
          select: { firstName: true, lastName: true, employeeCode: true }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Update the assignment to inactive instead of deleting
    await prisma.employeeLocation.update({
      where: { id: assignment.id },
      data: { 
        isActive: false,
        updatedAt: new Date()
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "REMOVE_LOCATION",
        resource: "EMPLOYEE_LOCATION",
        resourceId: assignment.id,
        oldValues: {
          locationName: assignment.location?.name || 'Unknown Location',
          employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
          employeeCode: assignment.employee.employeeCode,
        }
      }
    });

    return NextResponse.json({ 
      message: "Employee removed from location successfully" 
    });
  } catch (error) {
    console.error("Error removing employee from location:", error);
    return NextResponse.json(
      { error: "Failed to remove employee from location" },
      { status: 500 }
    );
  }
}

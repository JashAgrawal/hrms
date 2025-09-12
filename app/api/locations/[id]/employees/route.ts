import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const assignEmployeesSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1, "At least one employee must be selected"),
});

// GET /api/locations/[id]/employees - Get employees assigned to a location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and HR can view location assignments
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const employees = await prisma.employeeLocation.findMany({
      where: {
        locationId: id,
        isActive: true,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
            department: {
              select: {
                name: true,
              }
            }
          }
        }
      },
      orderBy: {
        assignedAt: 'desc'
      }
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error("Error fetching location employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch location employees" },
      { status: 500 }
    );
  }
}

// POST /api/locations/[id]/employees - Assign employees to a location
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and HR can assign employees to locations
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { employeeIds } = assignEmployeesSchema.parse(body);

    // Verify the location exists
    const location = await prisma.location.findUnique({
      where: { id }
    });

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Verify all employees exist
    const employees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        status: "ACTIVE"
      }
    });

    if (employees.length !== employeeIds.length) {
      return NextResponse.json(
        { error: "Some employees not found or inactive" },
        { status: 400 }
      );
    }

    // Create employee location assignments
    const assignments = employeeIds.map(employeeId => ({
      employeeId,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      radius: location.radius,
      isOfficeLocation: false,
      locationId: id,
      assignedBy: session.user.id,
      isActive: true,
    }));

    // Use createMany with skipDuplicates to avoid conflicts
    const result = await prisma.employeeLocation.createMany({
      data: assignments,
      skipDuplicates: true,
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ASSIGN_LOCATION",
        resource: "EMPLOYEE_LOCATION",
        resourceId: id,
        newValues: {
          locationName: location.name,
          employeeIds,
          assignedCount: result.count
        }
      }
    });

    return NextResponse.json({ 
      message: `${result.count} employees assigned successfully`,
      assignedCount: result.count 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }
    
    console.error("Error assigning employees to location:", error);
    return NextResponse.json(
      { error: "Failed to assign employees" },
      { status: 500 }
    );
  }
}

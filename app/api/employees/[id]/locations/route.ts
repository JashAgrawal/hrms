import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const assignLocationSchema = z.object({
  locationIds: z.array(z.string()),
});

// GET /api/employees/[id]/locations - Get employee's assigned locations
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employeeId = params.id;

    // Check permissions - admin, HR, manager, or the employee themselves
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { 
        id: true, 
        userId: true, 
        firstName: true, 
        lastName: true,
        reportingTo: true 
      }
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const canAccess = 
      ["ADMIN", "HR"].includes(session.user.role) ||
      employee.userId === session.user.id ||
      employee.reportingTo === session.user.id;

    if (!canAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const employeeLocations = await prisma.employeeLocation.findMany({
      where: {
        employeeId,
        isActive: true,
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            radius: true,
            timezone: true,
            workingHours: true,
          }
        }
      },
      orderBy: { assignedAt: "desc" },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "VIEW",
        resource: "EMPLOYEE_LOCATIONS",
        resourceId: employeeId,
        newValues: { locationCount: employeeLocations.length }
      }
    });

    return NextResponse.json({ 
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
      },
      locations: employeeLocations 
    });
  } catch (error) {
    console.error("Error fetching employee locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee locations" },
      { status: 500 }
    );
  }
}

// POST /api/employees/[id]/locations - Assign locations to employee
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and HR can assign locations
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const employeeId = params.id;
    const body = await request.json();
    const { locationIds } = assignLocationSchema.parse(body);

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true }
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Verify all locations exist
    const locations = await prisma.location.findMany({
      where: {
        id: { in: locationIds },
        isActive: true,
      }
    });

    if (locations.length !== locationIds.length) {
      return NextResponse.json(
        { error: "One or more locations not found" },
        { status: 400 }
      );
    }

    // Deactivate existing location assignments
    await prisma.employeeLocation.updateMany({
      where: {
        employeeId,
        isActive: true,
      },
      data: {
        isActive: false,
      }
    });

    // Create new location assignments
    const employeeLocations = await Promise.all(
      locationIds.map(locationId =>
        prisma.employeeLocation.create({
          data: {
            employeeId,
            locationId,
            assignedBy: session.user.id,
            isActive: true,
          },
          include: {
            location: {
              select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                radius: true,
              }
            }
          }
        })
      )
    );

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ASSIGN_LOCATIONS",
        resource: "EMPLOYEE",
        resourceId: employeeId,
        newValues: {
          employeeName: `${employee.firstName} ${employee.lastName}`,
          locationIds,
          locationNames: locations.map(l => l.name),
        }
      }
    });

    return NextResponse.json({ 
      message: "Locations assigned successfully",
      employeeLocations 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }
    
    console.error("Error assigning locations:", error);
    return NextResponse.json(
      { error: "Failed to assign locations" },
      { status: 500 }
    );
  }
}
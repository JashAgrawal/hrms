import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createLocationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(1).max(10000), // 1 meter to 10km
  timezone: z.string().default("Asia/Kolkata"),
  workingHours: z.object({
    monday: z.object({ start: z.string(), end: z.string() }).optional(),
    tuesday: z.object({ start: z.string(), end: z.string() }).optional(),
    wednesday: z.object({ start: z.string(), end: z.string() }).optional(),
    thursday: z.object({ start: z.string(), end: z.string() }).optional(),
    friday: z.object({ start: z.string(), end: z.string() }).optional(),
    saturday: z.object({ start: z.string(), end: z.string() }).optional(),
    sunday: z.object({ start: z.string(), end: z.string() }).optional(),
  }).optional(),
});

// GET /api/locations - List all locations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and HR can view all locations
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const locations = await prisma.location.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            employeeLocations: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: { name: "asc" },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "VIEW",
        resource: "LOCATIONS",
        newValues: { count: locations.length }
      }
    });

    return NextResponse.json({ locations });
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

// POST /api/locations - Create a new location
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and HR can create locations
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createLocationSchema.parse(body);

    // Check if location with same name already exists
    const existingLocation = await prisma.location.findFirst({
      where: {
        name: {
          equals: validatedData.name,
          mode: "insensitive",
        },
      },
    });

    if (existingLocation) {
      return NextResponse.json(
        { error: "Location with this name already exists" },
        { status: 400 }
      );
    }

    const location = await prisma.location.create({
      data: {
        name: validatedData.name,
        address: validatedData.address,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        radius: validatedData.radius,
        timezone: validatedData.timezone,
        workingHours: validatedData.workingHours,
        isActive: true,
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        resource: "LOCATION",
        resourceId: location.id,
        newValues: {
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          radius: location.radius,
        }
      }
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }
    
    console.error("Error creating location:", error);
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
}
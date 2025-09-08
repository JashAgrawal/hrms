import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/departments - List all active departments
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        headId: true,
        head: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            employees: {
              where: {
                status: "ACTIVE",
              },
            },
          },
        },
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json(
      { error: "Failed to fetch departments" },
      { status: 500 }
    );
  }
}

// POST /api/departments - Create a new department
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    // Check if department with same name already exists
    const existingDepartment = await prisma.department.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existingDepartment) {
      return NextResponse.json(
        { error: "Department with this name already exists" },
        { status: 400 }
      );
    }

    // Generate department code
    const code = name.toUpperCase().replace(/\s+/g, "_").substring(0, 10);

    const department = await prisma.department.create({
      data: {
        name,
        code,
        description,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    console.error("Error creating department:", error);
    return NextResponse.json(
      { error: "Failed to create department" },
      { status: 500 }
    );
  }
}

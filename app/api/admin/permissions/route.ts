import { NextRequest, NextResponse } from "next/server"
import { withRole } from "@/lib/api-middleware"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const CreatePermissionSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  module: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  description: z.string().optional()
})

// GET /api/admin/permissions - List all permissions
export const GET = withRole([UserRole.ADMIN], async (context, request) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { module: 'asc' },
        { resource: 'asc' },
        { action: 'asc' }
      ]
    })

    return NextResponse.json({ permissions })
  } catch (error) {
    console.error("Error fetching permissions:", error)
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    )
  }
})

// POST /api/admin/permissions - Create new permission
export const POST = withRole([UserRole.ADMIN], async (context, request) => {
  try {
    const body = await request.json()
    const data = CreatePermissionSchema.parse(body)

    const permission = await prisma.permission.create({
      data
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: context.user.id,
        action: "CREATE",
        resource: "PERMISSION",
        resourceId: permission.id,
        newValues: data
      }
    })

    return NextResponse.json({ permission }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Invalid request format",
          details: error.errors
        },
        { status: 400 }
      )
    }

    console.error("Error creating permission:", error)
    return NextResponse.json(
      { error: "Failed to create permission" },
      { status: 500 }
    )
  }
})
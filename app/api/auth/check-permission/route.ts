import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-middleware"
import { hasPermission, Permission } from "@/lib/permissions"
import { z } from "zod"

const PermissionCheckSchema = z.object({
  permission: z.object({
    module: z.string(),
    action: z.string(),
    resource: z.string()
  }),
  context: z.object({
    targetUserId: z.string().optional(),
    departmentId: z.string().optional(),
    resourceId: z.string().optional()
  }).optional()
})

export const POST = withAuth(async (context, request) => {
  try {
    const body = await request.json()
    const { permission, context: permissionContext } = PermissionCheckSchema.parse(body)

    const result = await hasPermission(
      context.user.id,
      permission as Permission,
      permissionContext
    )

    return NextResponse.json({
      allowed: result.allowed,
      reason: result.reason
    })

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

    console.error("Permission check error:", error)
    return NextResponse.json(
      { error: "Permission check failed" },
      { status: 500 }
    )
  }
})
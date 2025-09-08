import { NextRequest, NextResponse } from "next/server"
import { withRole } from "@/lib/api-middleware"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const AssignPermissionsSchema = z.object({
  permissionIds: z.array(z.string())
})

interface RouteParams {
  params: {
    roleId: string
  }
}

// GET /api/admin/roles/[roleId]/permissions - Get role permissions
export const GET = withRole([UserRole.ADMIN], async (context, request, routeContext) => {
  const { params } = routeContext as RouteParams;
  try {
    const role = await prisma.role.findUnique({
      where: { id: params.roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      )
    }

    const permissions = role.rolePermissions.map(rp => rp.permission)

    return NextResponse.json({ 
      role: {
        id: role.id,
        name: role.name,
        code: role.code,
        description: role.description
      },
      permissions 
    })
  } catch (error) {
    console.error("Error fetching role permissions:", error)
    return NextResponse.json(
      { error: "Failed to fetch role permissions" },
      { status: 500 }
    )
  }
})

// PUT /api/admin/roles/[roleId]/permissions - Update role permissions
export const PUT = withRole([UserRole.ADMIN], async (context, request, routeContext) => {
  const { params } = routeContext as RouteParams;
  try {
    const body = await request.json()
    const { permissionIds } = AssignPermissionsSchema.parse(body)

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: params.roleId }
    })

    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      )
    }

    // Verify all permissions exist
    const permissions = await prisma.permission.findMany({
      where: { id: { in: permissionIds } }
    })

    if (permissions.length !== permissionIds.length) {
      return NextResponse.json(
        { error: "One or more permissions not found" },
        { status: 400 }
      )
    }

    // Get current permissions for audit log
    const currentRolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: params.roleId },
      include: { permission: true }
    })

    // Remove all existing permissions for this role
    await prisma.rolePermission.deleteMany({
      where: { roleId: params.roleId }
    })

    // Add new permissions
    const newRolePermissions = await Promise.all(
      permissionIds.map(permissionId =>
        prisma.rolePermission.create({
          data: {
            roleId: params.roleId,
            permissionId
          },
          include: {
            permission: true
          }
        })
      )
    )

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: context.user.id,
        action: "UPDATE",
        resource: "ROLE_PERMISSIONS",
        resourceId: params.roleId,
        oldValues: {
          permissions: currentRolePermissions.map(rp => ({
            id: rp.permission.id,
            code: rp.permission.code
          }))
        },
        newValues: {
          permissions: newRolePermissions.map(rp => ({
            id: rp.permission.id,
            code: rp.permission.code
          }))
        }
      }
    })

    return NextResponse.json({ 
      message: "Role permissions updated successfully",
      permissions: newRolePermissions.map(rp => rp.permission)
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

    console.error("Error updating role permissions:", error)
    return NextResponse.json(
      { error: "Failed to update role permissions" },
      { status: 500 }
    )
  }
})
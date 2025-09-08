import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-middleware"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Password confirmation is required")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

// POST /api/auth/change-password - Change user's password
export const POST = withAuth(async (context, request) => {
  try {
    const body = await request.json()
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(body)

    // Get current user with password
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        id: true,
        email: true,
        password: true,
        name: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Check if user has a password (not OAuth-only user)
    if (!user.password) {
      return NextResponse.json(
        { error: "Cannot change password for OAuth-only accounts" },
        { status: 400 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      )
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) {
      return NextResponse.json(
        { error: "New password must be different from current password" },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    await prisma.user.update({
      where: { id: context.user.id },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date()
      }
    })

    // Log the action (without password details)
    await prisma.auditLog.create({
      data: {
        userId: context.user.id,
        action: "CHANGE_PASSWORD",
        resource: "USER",
        resourceId: context.user.id,
        newValues: {
          changedAt: new Date().toISOString(),
          userAgent: request.headers.get('user-agent'),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      }
    })

    return NextResponse.json({
      message: "Password changed successfully"
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

    console.error("Password change error:", error)
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    )
  }
})
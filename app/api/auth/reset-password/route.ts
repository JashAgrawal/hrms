import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import crypto from "crypto"

const RequestResetSchema = z.object({
  email: z.string().email("Invalid email format")
})

const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Password confirmation is required")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

// POST /api/auth/reset-password - Request password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = RequestResetSchema.parse(body)

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        password: true
      }
    })

    // Always return success to prevent email enumeration
    // But only send email if user exists and is active
    if (user && user.isActive && user.password) {
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex')
      const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

      // Store reset token in database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          // We'll add these fields to the schema if needed
          // For now, we'll use a separate table or store in a different way
          updatedAt: new Date()
        }
      })

      // Create a password reset record
      await prisma.$executeRaw`
        INSERT INTO password_resets (user_id, token, expires_at, created_at)
        VALUES (${user.id}, ${resetToken}, ${resetTokenExpiry}, ${new Date()})
        ON CONFLICT (user_id) 
        DO UPDATE SET token = ${resetToken}, expires_at = ${resetTokenExpiry}, created_at = ${new Date()}
      `.catch(async () => {
        // If table doesn't exist, create it
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS password_resets (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL UNIQUE,
            token TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            used_at TIMESTAMP NULL
          )
        `
        
        // Try insert again
        await prisma.$executeRaw`
          INSERT INTO password_resets (user_id, token, expires_at, created_at)
          VALUES (${user.id}, ${resetToken}, ${resetTokenExpiry}, ${new Date()})
          ON CONFLICT (user_id) 
          DO UPDATE SET token = ${resetToken}, expires_at = ${resetTokenExpiry}, created_at = ${new Date()}
        `
      })

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "REQUEST_PASSWORD_RESET",
          resource: "USER",
          resourceId: user.id,
          newValues: {
            requestedAt: new Date().toISOString(),
            userAgent: request.headers.get('user-agent'),
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
          }
        }
      })

      // In a real application, you would send an email here
      // For now, we'll just log the token (NEVER do this in production)
      console.log(`Password reset token for ${email}: ${resetToken}`)
      
      // TODO: Send email with reset link
      // await sendPasswordResetEmail(user.email, user.name, resetToken)
    }

    return NextResponse.json({
      message: "If an account with that email exists, a password reset link has been sent."
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

    console.error("Password reset request error:", error)
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    )
  }
}

// PUT /api/auth/reset-password - Reset password with token
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, newPassword } = ResetPasswordSchema.parse(body)

    // Find valid reset token
    const resetRecord = await prisma.$queryRaw<Array<{
      user_id: string
      token: string
      expires_at: Date
      used_at: Date | null
    }>>`
      SELECT user_id, token, expires_at, used_at
      FROM password_resets
      WHERE token = ${token}
      AND expires_at > NOW()
      AND used_at IS NULL
      LIMIT 1
    `

    if (!resetRecord || resetRecord.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      )
    }

    const userId = resetRecord[0].user_id

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        password: true
      }
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "User not found or inactive" },
        { status: 400 }
      )
    }

    // Check if new password is different from current (if user has a password)
    if (user.password) {
      const isSamePassword = await bcrypt.compare(newPassword, user.password)
      if (isSamePassword) {
        return NextResponse.json(
          { error: "New password must be different from current password" },
          { status: 400 }
        )
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password and mark token as used
    await prisma.$transaction(async (tx) => {
      // Update user password
      await tx.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      })

      // Mark reset token as used
      await tx.$executeRaw`
        UPDATE password_resets
        SET used_at = NOW()
        WHERE token = ${token}
      `
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: userId,
        action: "RESET_PASSWORD",
        resource: "USER",
        resourceId: userId,
        newValues: {
          resetAt: new Date().toISOString(),
          userAgent: request.headers.get('user-agent'),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      }
    })

    return NextResponse.json({
      message: "Password reset successfully"
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

    console.error("Password reset error:", error)
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    )
  }
}
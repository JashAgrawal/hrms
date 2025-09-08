import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-middleware"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const UpdateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional()
  }).optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional()
  }).optional()
})

// GET /api/profile - Get current user's profile
export const GET = withAuth(async (context, request) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      include: {
        employee: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
                code: true
              }
            },
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true
              }
            }
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Return profile data (without sensitive information)
    const profile = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      },
      employee: user.employee ? {
        id: user.employee.id,
        employeeCode: user.employee.employeeCode,
        firstName: user.employee.firstName,
        lastName: user.employee.lastName,
        email: user.employee.email,
        phone: user.employee.phone,
        dateOfBirth: user.employee.dateOfBirth,
        gender: user.employee.gender,
        address: user.employee.address,
        designation: user.employee.designation,
        department: user.employee.department,
        joiningDate: user.employee.joiningDate,
        employmentType: user.employee.employmentType,
        status: user.employee.status,
        manager: user.employee.manager,
        basicSalary: user.employee.basicSalary,
        ctc: user.employee.ctc,
        salaryGrade: user.employee.salaryGrade
      } : null
    }

    return NextResponse.json({ profile })

  } catch (error) {
    console.error("Profile fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    )
  }
})

// PUT /api/profile - Update current user's profile
export const PUT = withAuth(async (context, request) => {
  try {
    const body = await request.json()
    const data = UpdateProfileSchema.parse(body)

    // Get current user data for audit log
    const currentUser = await prisma.user.findUnique({
      where: { id: context.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Update user and employee in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user table
      const updatedUser = await tx.user.update({
        where: { id: context.user.id },
        data: {
          name: data.name,
          updatedAt: new Date()
        }
      })

      // Update employee table if employee exists and data provided
      let updatedEmployee = null
      if (currentUser.employee) {
        const employeeUpdateData: Record<string, any> = {}
        
        if (data.phone !== undefined) employeeUpdateData.phone = data.phone
        if (data.dateOfBirth !== undefined) {
          employeeUpdateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null
        }
        if (data.address !== undefined) employeeUpdateData.address = data.address

        if (Object.keys(employeeUpdateData).length > 0) {
          employeeUpdateData.updatedAt = new Date()
          
          updatedEmployee = await tx.employee.update({
            where: { id: currentUser.employee.id },
            data: employeeUpdateData
          })
        }
      }

      return { user: updatedUser, employee: updatedEmployee }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: context.user.id,
        action: "UPDATE",
        resource: "PROFILE",
        resourceId: context.user.id,
        oldValues: {
          name: currentUser.name,
          phone: currentUser.employee?.phone,
          dateOfBirth: currentUser.employee?.dateOfBirth,
          address: currentUser.employee?.address
        },
        newValues: {
          name: data.name,
          phone: data.phone,
          dateOfBirth: data.dateOfBirth,
          address: data.address
        }
      }
    })

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        updatedAt: result.user.updatedAt
      }
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

    console.error("Profile update error:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
})
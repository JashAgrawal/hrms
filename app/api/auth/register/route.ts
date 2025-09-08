import { NextRequest, NextResponse } from "next/server"
import { withRole } from "@/lib/api-middleware"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const RegisterUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(UserRole).default(UserRole.EMPLOYEE),
  employeeData: z.object({
    employeeCode: z.string().min(1, "Employee code is required"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    designation: z.string().min(1, "Designation is required"),
    departmentId: z.string().min(1, "Department is required"),
    joiningDate: z.string().min(1, "Joining date is required"),
    employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
    reportingTo: z.string().optional(),
    basicSalary: z.number().positive().optional(),
    ctc: z.number().positive().optional(),
    salaryGrade: z.string().optional(),
    panNumber: z.string().optional(),
    aadharNumber: z.string().optional(),
    pfNumber: z.string().optional(),
    esiNumber: z.string().optional()
  }).optional()
})

// POST /api/auth/register - Register new user (Admin/HR only)
export const POST = withRole([UserRole.ADMIN, UserRole.HR], async (context, request) => {
  try {
    const body = await request.json()
    const data = RegisterUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Check if employee code already exists (if provided)
    if (data.employeeData?.employeeCode) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { employeeCode: data.employeeData.employeeCode }
      })

      if (existingEmployee) {
        return NextResponse.json(
          { error: "Employee code already exists" },
          { status: 400 }
        )
      }
    }

    // Validate department exists (if provided)
    if (data.employeeData?.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.employeeData.departmentId }
      })

      if (!department) {
        return NextResponse.json(
          { error: "Department not found" },
          { status: 400 }
        )
      }
    }

    // Validate reporting manager exists (if provided)
    if (data.employeeData?.reportingTo) {
      const manager = await prisma.employee.findUnique({
        where: { id: data.employeeData.reportingTo }
      })

      if (!manager) {
        return NextResponse.json(
          { error: "Reporting manager not found" },
          { status: 400 }
        )
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12)

    // Create user and employee in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          password: hashedPassword,
          role: data.role,
          isActive: true
        }
      })

      // Create employee record if employee data provided
      let employee = null
      if (data.employeeData) {
        employee = await tx.employee.create({
          data: {
            userId: user.id,
            employeeCode: data.employeeData.employeeCode,
            firstName: data.employeeData.firstName,
            lastName: data.employeeData.lastName,
            email: data.email,
            phone: data.employeeData.phone,
            dateOfBirth: data.employeeData.dateOfBirth ? new Date(data.employeeData.dateOfBirth) : null,
            gender: data.employeeData.gender,
            designation: data.employeeData.designation,
            departmentId: data.employeeData.departmentId,
            joiningDate: new Date(data.employeeData.joiningDate),
            employmentType: data.employeeData.employmentType,
            reportingTo: data.employeeData.reportingTo,
            basicSalary: data.employeeData.basicSalary,
            ctc: data.employeeData.ctc,
            salaryGrade: data.employeeData.salaryGrade,
            panNumber: data.employeeData.panNumber,
            aadharNumber: data.employeeData.aadharNumber,
            pfNumber: data.employeeData.pfNumber,
            esiNumber: data.employeeData.esiNumber,
            status: 'ACTIVE'
          }
        })
      }

      return { user, employee }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: context.user.id,
        action: "CREATE",
        resource: "USER",
        resourceId: result.user.id,
        newValues: {
          email: data.email,
          name: data.name,
          role: data.role,
          employeeCode: data.employeeData?.employeeCode,
          createdBy: context.user.email
        }
      }
    })

    // Return user data (without password)
    const responseData = {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        isActive: result.user.isActive,
        createdAt: result.user.createdAt
      },
      employee: result.employee ? {
        id: result.employee.id,
        employeeCode: result.employee.employeeCode,
        firstName: result.employee.firstName,
        lastName: result.employee.lastName,
        designation: result.employee.designation,
        departmentId: result.employee.departmentId,
        joiningDate: result.employee.joiningDate,
        status: result.employee.status
      } : null
    }

    return NextResponse.json(responseData, { status: 201 })

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

    console.error("User registration error:", error)
    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    )
  }
})
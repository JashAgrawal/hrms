import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for employee update
const updateEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  designation: z.string().min(1, 'Designation is required').optional(),
  departmentId: z.string().min(1, 'Department is required').optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
  employeeType: z.enum(['NORMAL', 'FIELD_EMPLOYEE']).optional(),
  reportingTo: z.string().optional(),
  basicSalary: z.number().positive().optional(),
  ctc: z.number().positive().optional(),
  salaryGrade: z.string().optional(),
  panNumber: z.string().optional(),
  aadharNumber: z.string().optional(),
  pfNumber: z.string().optional(),
  esiNumber: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE']).optional(),
})

// GET /api/employees/[id] - Get employee by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          }
        },
        subordinates: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
            status: true,
          }
        },
        attendanceRecords: {
          take: 5,
          orderBy: { date: 'desc' },
          select: {
            id: true,
            date: true,
            checkIn: true,
            checkOut: true,
            status: true,
            workHours: true,
          }
        },
        leaveRequests: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            days: true,
            status: true,
            reason: true,
            policy: {
              select: {
                name: true,
                type: true,
              }
            }
          }
        },
        documents: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            category: true,
            fileName: true,
            fileSize: true,
            createdAt: true,
          }
        }
      }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check if user can view this employee
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    const canView = 
      ['ADMIN', 'HR'].includes(currentUser?.role || '') ||
      currentUser?.employee?.id === employee.id ||
      currentUser?.employee?.id === employee.reportingTo

    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    return NextResponse.json({ employee })
  } catch (error) {
    console.error('Error fetching employee:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    )
  }
}

// PUT /api/employees/[id] - Update employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id } = await params
    
    // Check permissions
    const canEdit = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      currentUser.employee?.id === id

    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateEmployeeSchema.parse(body)

    // Get current employee data for audit log
    const currentEmployee = await prisma.employee.findUnique({
      where: { id }
    })

    if (!currentEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Update employee in transaction
    const updatedEmployee = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: {
          ...validatedData,
          dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              role: true,
              isActive: true,
            }
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            }
          },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            }
          },
        }
      })

      // Update user name if first/last name changed
      if (validatedData.firstName || validatedData.lastName) {
        await tx.user.update({
          where: { id: employee.userId },
          data: {
            name: `${employee.firstName} ${employee.lastName}`
          }
        })
      }

      // Log the update
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE',
          resource: 'EMPLOYEE',
          resourceId: employee.id,
          oldValues: {
            firstName: currentEmployee.firstName,
            lastName: currentEmployee.lastName,
            designation: currentEmployee.designation,
            status: currentEmployee.status,
          },
          newValues: {
            firstName: employee.firstName,
            lastName: employee.lastName,
            designation: employee.designation,
            status: employee.status,
          }
        }
      })

      return employee
    })

    return NextResponse.json({
      employee: updatedEmployee,
      message: 'Employee updated successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating employee:', error)
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    )
  }
}

// DELETE /api/employees/[id] - Soft delete employee
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Soft delete by updating status and deactivating user
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: { status: 'TERMINATED' }
      })

      await tx.user.update({
        where: { id: employee.userId },
        data: { isActive: false }
      })

      // Log the deletion
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'DELETE',
          resource: 'EMPLOYEE',
          resourceId: employee.id,
          oldValues: {
            status: employee.status,
            isActive: true,
          },
          newValues: {
            status: 'TERMINATED',
            isActive: false,
          }
        }
      })
    })

    return NextResponse.json({
      message: 'Employee deactivated successfully'
    })

  } catch (error) {
    console.error('Error deleting employee:', error)
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    )
  }
}
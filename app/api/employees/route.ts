import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import page from '@/app/page'
import { EmployeeStatus, EmploymentType, Prisma } from '@prisma/client'

// Validation schema for employee creation
const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
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
  designation: z.string().min(1, 'Designation is required'),
  departmentId: z.string().min(1, 'Department is required'),
  joiningDate: z.string().min(1, 'Joining date is required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
  employeeType: z.enum(['NORMAL', 'FIELD_EMPLOYEE']).default('NORMAL'),
  reportingTo: z.string().optional(),
  basicSalary: z.number().positive().optional(),
  ctc: z.number().positive().optional(),
  salaryGrade: z.string().optional(),
  panNumber: z.string().optional(),
  aadharNumber: z.string().optional(),
  pfNumber: z.string().optional(),
  esiNumber: z.string().optional(),
})

// GET /api/employees - List employees with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const department = searchParams.get('department') || ''
    const status = searchParams.get('status') || ''
    const employmentType = searchParams.get('employmentType') || ''
    const joiningDateFrom = searchParams.get('joiningDateFrom') || ''
    const joiningDateTo = searchParams.get('joiningDateTo') || ''
    const salaryMin = searchParams.get('salaryMin') || ''
    const salaryMax = searchParams.get('salaryMax') || ''
    const designation = searchParams.get('designation') || ''
    const location = searchParams.get('location') || ''

    const skip = (page - 1) * limit

    // Build where clause for filtering
    const argsss: Prisma.EmployeeFindManyArgs = {where:{}}

    if(argsss.where === undefined) {
      argsss.where = {}
    }
    
    if (search) {
      argsss.where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { panNumber: { contains: search, mode: 'insensitive' } },
        { department: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (department) {
      argsss.where.departmentId = department
    }

    if (status) {
      // Validate status against enum values
      const validStatuses = ['ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE']
      if (validStatuses.includes(status.toUpperCase())) {
        argsss.where.status = status.toUpperCase() as EmployeeStatus
      }
    }

    if (employmentType) {
      // Validate employment type against enum values
      const validEmploymentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']
      if (validEmploymentTypes.includes(employmentType.toUpperCase())) {
        argsss.where.employmentType = employmentType.toUpperCase() as EmploymentType
      }
    }

    if (joiningDateFrom || joiningDateTo) {
      const dateFilter: { gte?: Date; lte?: Date } = {}
      if (joiningDateFrom) {
        dateFilter.gte = new Date(joiningDateFrom)
      }
      if (joiningDateTo) {
        dateFilter.lte = new Date(joiningDateTo)
      }
      argsss.where.joiningDate = dateFilter
    }

    if (salaryMin || salaryMax) {
      const salaryFilter: { gte?: number; lte?: number } = {}
      if (salaryMin) {
        salaryFilter.gte = parseFloat(salaryMin)
      }
      if (salaryMax) {
        salaryFilter.lte = parseFloat(salaryMax)
      }
      argsss.where.ctc = salaryFilter
    }

    if (designation) {
      argsss.where.designation = { contains: designation, mode: 'insensitive' }
    }

    if (location) {
      argsss.where.address = {
        path: ['city'],
        string_contains: location
      }
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where:argsss.where,
        skip,
        take: limit,
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
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.employee.count({ where:argsss.where })
    ])

    return NextResponse.json({
      employees,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching employees:', error)
    
    // Log the query parameters for debugging
    // console.error('Query parameters:', {
    //   page, limit, search, department, status, employmentType,
    //   joiningDateFrom, joiningDateTo, salaryMin, salaryMax, designation, location
    // })
    
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

// POST /api/employees - Create new employee
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create employees
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createEmployeeSchema.parse(body)

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Generate employee code
    const lastEmployee = await prisma.employee.findFirst({
      orderBy: { employeeCode: 'desc' }
    })
    
    let nextNumber = 1
    if (lastEmployee?.employeeCode) {
      const match = lastEmployee.employeeCode.match(/EMP(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    
    const employeeCode = `EMP${nextNumber.toString().padStart(4, '0')}`

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8)
    const hashedPassword = await bcrypt.hash(tempPassword, 12)

    // Create user and employee in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user account
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          name: `${validatedData.firstName} ${validatedData.lastName}`,
          password: hashedPassword,
          role: 'EMPLOYEE',
          isActive: true,
        }
      })

      // Create employee profile
      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          employeeCode,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          email: validatedData.email,
          phone: validatedData.phone,
          dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null,
          gender: validatedData.gender,
          address: validatedData.address,
          designation: validatedData.designation,
          departmentId: validatedData.departmentId,
          joiningDate: new Date(validatedData.joiningDate),
          employmentType: validatedData.employmentType,
          employeeType: validatedData.employeeType,
          reportingTo: validatedData.reportingTo,
          basicSalary: validatedData.basicSalary,
          ctc: validatedData.ctc,
          salaryGrade: validatedData.salaryGrade,
          panNumber: validatedData.panNumber,
          aadharNumber: validatedData.aadharNumber,
          pfNumber: validatedData.pfNumber,
          esiNumber: validatedData.esiNumber,
          status: 'ACTIVE',
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

      // Log the creation
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE',
          resource: 'EMPLOYEE',
          resourceId: employee.id,
          newValues: {
            employeeCode: employee.employeeCode,
            name: `${employee.firstName} ${employee.lastName}`,
            email: employee.email,
          }
        }
      })

      return { employee, tempPassword }
    })

    return NextResponse.json({
      employee: result.employee,
      tempPassword: result.tempPassword,
      message: 'Employee created successfully'
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating employee:', error)
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const department = searchParams.get('department')
    const status = searchParams.get('status')
    const employmentType = searchParams.get('employmentType')

    // Build where clause
    const where: any = {}
    
    if (status) {
      where.status = status
    }
    
    if (department) {
      where.departmentId = department
    }

    if (employmentType) {
      where.employmentType = employmentType
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { 
          department: {
            name: { contains: search, mode: 'insensitive' }
          }
        }
      ]
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Get total count for pagination
    const total = await prisma.employee.count({ where })

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        designation: true,
        joiningDate: true,
        status: true,
        employmentType: true,
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
        }
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ],
      skip,
      take: limit,
    })

    const pages = Math.ceil(total / limit)

    return NextResponse.json({ 
      employees,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    })
  } catch (error) {
    console.error("Error fetching employees:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST method for creating employees
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Generate employee code
    const lastEmployee = await prisma.employee.findFirst({
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true }
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
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    // Create user account first
    const user = await prisma.user.create({
      data: {
        email: body.email,
        password: hashedPassword,
        role: UserRole.EMPLOYEE,
        isActive: true,
      }
    })

    // Create employee with user account
    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender || null,
        address: body.address || null,
        designation: body.designation,
        departmentId: body.departmentId,
        joiningDate: new Date(body.joiningDate),
        employmentType: body.employmentType || 'FULL_TIME',
        employeeType: body.employeeType || 'NORMAL',
        reportingTo: body.reportingTo || null,
        basicSalary: body.basicSalary ? parseFloat(body.basicSalary.toString()) : null,
        ctc: body.ctc ? parseFloat(body.ctc.toString()) : null,
        salaryGrade: body.salaryGrade || null,
        panNumber: body.panNumber || null,
        aadharNumber: body.aadharNumber || null,
        pfNumber: body.pfNumber || null,
        esiNumber: body.esiNumber || null,
        bankAccountNumber: body.bankAccountNumber || null,
        bankIFSC: body.bankIFSC || null,
        bankName: body.bankName || null,
        bankBranch: body.bankBranch || null,
        status: body.status || 'ACTIVE',
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        user: {
          select: {
            id: true,
            role: true,
            isActive: true,
          }
        }
      }
    })

    return NextResponse.json({
      employee,
      tempPassword,
      message: "Employee created successfully"
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating employee:", error)

    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      if (error.message.includes('email')) {
        return NextResponse.json(
          { error: "Email address already exists" },
          { status: 400 }
        )
      }
      if (error.message.includes('employeeCode')) {
        return NextResponse.json(
          { error: "Employee code already exists" },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
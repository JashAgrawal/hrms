import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const exportSchema = z.object({
  employeeIds: z.array(z.string()).optional(),
  format: z.enum(['csv', 'excel']).default('csv'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to export
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR', 'MANAGER'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { employeeIds, format } = exportSchema.parse(body)

    // Build where clause
    const where: { id?: { in: string[] } } = {}
    if (employeeIds && employeeIds.length > 0) {
      where.id = { in: employeeIds }
    }

    // Fetch employee data
    const employees = await prisma.employee.findMany({
      where,
      include: {
        department: {
          select: {
            name: true,
            code: true,
          }
        },
        manager: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          }
        },
        user: {
          select: {
            role: true,
            isActive: true,
            lastLoginAt: true,
          }
        }
      },
      orderBy: { employeeCode: 'asc' }
    })

    // Generate CSV content
    const headers = [
      'Employee Code',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Designation',
      'Department',
      'Employment Type',
      'Status',
      'Joining Date',
      'Basic Salary',
      'CTC',
      'Manager',
      'Role',
      'Last Login',
    ]

    const csvRows = [
      headers.join(','),
      ...employees.map(emp => [
        emp.employeeCode,
        emp.firstName,
        emp.lastName,
        emp.email,
        emp.phone || '',
        emp.designation,
        emp.department.name,
        emp.employmentType.replace('_', ' '),
        emp.status.replace('_', ' '),
        emp.joiningDate.toISOString().split('T')[0],
        emp.basicSalary?.toString() || '',
        emp.ctc?.toString() || '',
        emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName} (${emp.manager.employeeCode})` : '',
        emp.user.role,
        emp.user.lastLoginAt ? emp.user.lastLoginAt.toISOString().split('T')[0] : '',
      ].map(field => `"${field}"`).join(','))
    ]

    const csvContent = csvRows.join('\n')

    // Log the export
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'EXPORT',
        resource: 'EMPLOYEE',
        newValues: {
          count: employees.length,
          format,
          exportedAt: new Date().toISOString(),
        }
      }
    })

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="employees-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export employee data' },
      { status: 500 }
    )
  }
}
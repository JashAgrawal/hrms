import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const importSchema = z.object({
  csvData: z.string().min(1, 'CSV data is required'),
  skipFirstRow: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to import
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { csvData, skipFirstRow } = importSchema.parse(body)

    // Parse CSV data
    const lines = csvData.trim().split('\n')
    const dataLines = skipFirstRow ? lines.slice(1) : lines

    if (dataLines.length === 0) {
      return NextResponse.json({ error: 'No data rows found in CSV' }, { status: 400 })
    }

    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: [] as string[],
      warnings: [] as string[]
    }

    // Expected CSV format: employeeCode, firstName, lastName, email, phone, designation, departmentName, employmentType, joiningDate, basicSalary
    for (const [index, line] of dataLines.entries()) {
      try {
        const values = parseCsvLine(line)
        
        if (values.length < 4) {
          results.errors.push(`Row ${index + 1}: Insufficient data (need at least employeeCode, firstName, lastName, email)`)
          continue
        }

        const [employeeCode, firstName, lastName, email, phone, designation, departmentName, employmentType, joiningDate, basicSalary] = values

        // Validate required fields
        if (!employeeCode || !firstName || !lastName || !email) {
          results.errors.push(`Row ${index + 1}: Missing required fields`)
          continue
        }

        // Find or create department
        let departmentId: string
        if (departmentName) {
          let department = await prisma.department.findFirst({
            where: { name: { equals: departmentName, mode: 'insensitive' } }
          })
          
          if (!department) {
            department = await prisma.department.create({
              data: {
                name: departmentName,
                code: departmentName.toUpperCase().replace(/\s+/g, '_'),
              }
            })
          }
          departmentId = department.id
        } else {
          // Default department
          let defaultDept = await prisma.department.findFirst({
            where: { code: 'GENERAL' }
          })
          
          if (!defaultDept) {
            defaultDept = await prisma.department.create({
              data: {
                name: 'General',
                code: 'GENERAL',
              }
            })
          }
          departmentId = defaultDept.id
        }

        // Check if employee already exists
        const existingEmployee = await prisma.employee.findUnique({
          where: { employeeCode },
          include: { user: true }
        })

        const employeeData = {
          firstName,
          lastName,
          email,
          phone: phone || null,
          designation: designation || 'Employee',
          departmentId,
          employmentType: (employmentType?.toUpperCase() as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN') || 'FULL_TIME',
          joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
          basicSalary: basicSalary ? parseFloat(basicSalary) : null,
        }

        if (existingEmployee) {
          // Update existing employee
          await prisma.$transaction(async (tx) => {
            await tx.employee.update({
              where: { id: existingEmployee.id },
              data: employeeData
            })

            // Update user email if changed
            if (existingEmployee.user.email !== email) {
              await tx.user.update({
                where: { id: existingEmployee.userId },
                data: { email }
              })
            }
          })

          results.updated++
        } else {
          // Create new employee
          await prisma.$transaction(async (tx) => {
            // Create user first
            const user = await tx.user.create({
              data: {
                email,
                name: `${firstName} ${lastName}`,
                role: 'EMPLOYEE',
              }
            })

            // Create employee
            await tx.employee.create({
              data: {
                ...employeeData,
                employeeCode,
                userId: user.id,
              }
            })
          })

          results.created++
        }

        results.processed++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(`Row ${index + 1}: ${errorMsg}`)
      }
    }

    // Log the import
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'BULK_IMPORT',
        resource: 'EMPLOYEE',
        newValues: {
          ...results,
          importedAt: new Date().toISOString(),
        }
      }
    })

    return NextResponse.json({
      message: `Import completed: ${results.created} created, ${results.updated} updated`,
      results
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Failed to import employee data' },
      { status: 500 }
    )
  }
}

// Helper function to parse CSV line with proper quote handling
function parseCsvLine(line: string): string[] {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"' && !inQuotes) {
      inQuotes = true
    } else if (char === '"' && inQuotes && nextChar === '"') {
      current += '"'
      i++ // skip next quote
    } else if (char === '"' && inQuotes) {
      inQuotes = false
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

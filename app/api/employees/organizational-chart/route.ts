import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/employees/organizational-chart - Get organizational hierarchy data
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to view organizational chart
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all active employees with their relationships
    const employees = await prisma.employee.findMany({
      where: { 
        status: 'ACTIVE'
      },
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
        reportingTo: true,
        address: true,
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
      orderBy: [
        { department: { name: 'asc' } },
        { designation: 'asc' },
        { firstName: 'asc' }
      ]
    })

    // Build hierarchy structure
    const employeeMap = new Map<string, EmployeeWithSubordinates>()
    const rootEmployees: EmployeeWithSubordinates[] = []

    // Define the employee type with subordinates
    type EmployeeWithSubordinates = typeof employees[0] & {
      subordinates: EmployeeWithSubordinates[]
    }

    // First pass: create employee objects with subordinates array
    employees.forEach(employee => {
      const employeeWithSubordinates: EmployeeWithSubordinates = {
        ...employee,
        subordinates: []
      }
      employeeMap.set(employee.id, employeeWithSubordinates)
    })

    // Second pass: build the hierarchy
    employees.forEach(employee => {
      const employeeWithSubordinates = employeeMap.get(employee.id)
      
      if (employeeWithSubordinates) {
        if (employee.reportingTo) {
          const manager = employeeMap.get(employee.reportingTo)
          if (manager) {
            manager.subordinates.push(employeeWithSubordinates)
          } else {
            // Manager not found in active employees, treat as root
            rootEmployees.push(employeeWithSubordinates)
          }
        } else {
          // No reporting manager, this is a root employee
          rootEmployees.push(employeeWithSubordinates)
        }
      }
    })

    // Sort subordinates by designation and name
    const sortSubordinates = (employeeList: EmployeeWithSubordinates[]) => {
      employeeList.forEach(emp => {
        if (emp.subordinates.length > 0) {
          emp.subordinates.sort((a, b) => {
            // First sort by designation (managers/leads first)
            const aIsManager = a.designation.toLowerCase().includes('manager') || 
                              a.designation.toLowerCase().includes('lead') ||
                              a.designation.toLowerCase().includes('head')
            const bIsManager = b.designation.toLowerCase().includes('manager') || 
                              b.designation.toLowerCase().includes('lead') ||
                              b.designation.toLowerCase().includes('head')
            
            if (aIsManager && !bIsManager) return -1
            if (!aIsManager && bIsManager) return 1
            
            // Then sort by name
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
          })
          sortSubordinates(emp.subordinates)
        }
      })
    }

    sortSubordinates(rootEmployees)

    // Group employees by department for department view
    const departmentMap = new Map<string, {
      id: string
      name: string
      code: string
      employees: EmployeeWithSubordinates[]
    }>()
    
    employees.forEach(employee => {
      const deptId = employee.department.id
      if (!departmentMap.has(deptId)) {
        departmentMap.set(deptId, {
          id: employee.department.id,
          name: employee.department.name,
          code: employee.department.code,
          employees: []
        })
      }
      
      // For department view, we want the flat structure with immediate subordinates
      const employeeWithSubordinates = employeeMap.get(employee.id)
      const department = departmentMap.get(deptId)
      if (department && employeeWithSubordinates) {
        department.employees.push(employeeWithSubordinates)
      }
    })

    const departments = Array.from(departmentMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    )

    // Sort employees within each department
    departments.forEach(dept => {
      dept.employees.sort((a, b) => {
        // Managers first
        const aIsManager = a.designation.toLowerCase().includes('manager') || 
                          a.designation.toLowerCase().includes('head') ||
                          a.designation.toLowerCase().includes('lead')
        const bIsManager = b.designation.toLowerCase().includes('manager') || 
                          b.designation.toLowerCase().includes('head') ||
                          b.designation.toLowerCase().includes('lead')
        
        if (aIsManager && !bIsManager) return -1
        if (!aIsManager && bIsManager) return 1
        
        // Then by designation
        const designationCompare = a.designation.localeCompare(b.designation)
        if (designationCompare !== 0) return designationCompare
        
        // Finally by name
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      })
    })

    return NextResponse.json({
      hierarchy: rootEmployees,
      departments: departments,
      totalEmployees: employees.length,
      totalDepartments: departments.length
    })

  } catch (error) {
    console.error('Error fetching organizational chart:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizational chart' },
      { status: 500 }
    )
  }
}
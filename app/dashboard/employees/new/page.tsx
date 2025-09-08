import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EmployeeForm } from '@/components/employees/employee-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

async function getDepartments() {
  return await prisma.department.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { name: 'asc' }
  })
}

async function getManagers() {
  return await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { designation: { contains: 'Manager', mode: 'insensitive' } },
        { designation: { contains: 'Lead', mode: 'insensitive' } },
        { designation: { contains: 'Head', mode: 'insensitive' } },
        { designation: { contains: 'Director', mode: 'insensitive' } },
      ]
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      designation: true,
      department: {
        select: {
          name: true,
        }
      }
    },
    orderBy: { firstName: 'asc' }
  })
}

export default async function NewEmployeePage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Check if user has permission to create employees
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
    redirect('/dashboard/employees')
  }

  const [departments, managers] = await Promise.all([
    getDepartments(),
    getManagers()
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/employees">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employees
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add New Employee</h1>
          <p className="text-muted-foreground">
            Create a new employee profile with all necessary information
          </p>
        </div>
      </div>

      {/* Employee Form */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Information</CardTitle>
          <CardDescription>
            Fill in the employee details below. All fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm 
            departments={departments}
            managers={managers}
          />
        </CardContent>
      </Card>
    </div>
  )
}
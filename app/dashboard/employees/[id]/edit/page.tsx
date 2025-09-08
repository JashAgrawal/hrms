import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EmployeeForm } from '@/components/employees/employee-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

async function getEmployee(id: string) {
  return await prisma.employee.findUnique({
    where: { id },
    include: {
      department: {
        select: {
          id: true,
          name: true,
        }
      },
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        }
      }
    }
  })
}

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

export default async function EditEmployeePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const employee = await getEmployee(params.id)
  
  if (!employee) {
    notFound()
  }

  // Check if user can edit this employee
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { employee: true }
  })

  const canEdit = 
    ['ADMIN', 'HR'].includes(currentUser?.role || '') ||
    currentUser?.employee?.id === employee.id

  if (!canEdit) {
    redirect(`/dashboard/employees/${employee.id}`)
  }

  const [departments, managers] = await Promise.all([
    getDepartments(),
    getManagers()
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/employees/${employee.id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Employee</h1>
          <p className="text-muted-foreground">
            Update {employee.firstName} {employee.lastName}&apos;s information
          </p>
        </div>
      </div>

      {/* Employee Form */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Information</CardTitle>
          <CardDescription>
            Update the employee details below. All fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm 
            employee={{
              ...employee,
              address: employee.address as Record<string, unknown> | undefined,
              basicSalary: employee.basicSalary ? Number(employee.basicSalary) : undefined,
              ctc: employee.ctc ? Number(employee.ctc) : undefined,
            }}
            departments={departments}
            managers={managers}
            isEditing={true}
          />
        </CardContent>
      </Card>
    </div>
  )
}
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { EmployeeList } from '@/components/employees/employee-list'
import { EmployeeAdvancedSearch } from '@/components/employees/employee-advanced-search'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Users, UserCheck, UserX, Clock } from 'lucide-react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

async function getEmployeeStats() {
  const [total, active, inactive, onLeave] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: 'ACTIVE' } }),
    prisma.employee.count({ where: { status: 'INACTIVE' } }),
    prisma.employee.count({ where: { status: 'ON_LEAVE' } }),
  ])

  return { total, active, inactive, onLeave }
}

async function getDepartments() {
  return await prisma.department.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      _count: {
        select: {
          employees: {
            where: {
              status: 'ACTIVE'
            }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  })
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Check if user has permission to view employees
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { employee: true }
  })

  if (!currentUser || !['ADMIN', 'HR', 'MANAGER'].includes(currentUser.role)) {
    redirect('/dashboard')
  }

  const [stats, departments] = await Promise.all([
    getEmployeeStats(),
    getDepartments()
  ])
  const canCreateEmployee = ['ADMIN', 'HR'].includes(currentUser.role)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage employee profiles and information
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/employees/directory">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Directory
            </Button>
          </Link>
          {canCreateEmployee && (
            <Link href="/dashboard/employees/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All employees in system
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently working
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Leave</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.onLeave}</div>
            <p className="text-xs text-muted-foreground">
              Currently on leave
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">
              Not currently active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Search */}
      <Suspense fallback={<div>Loading search...</div>}>
        <EmployeeAdvancedSearch departments={departments} />
      </Suspense>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
          <CardDescription>
            Browse and manage employee profiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading employees...</div>}>
            <EmployeeList searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
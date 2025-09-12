import { Suspense } from 'react'
import { EmployeeList } from '@/components/employees/employee-list'
import { EmployeeAdvancedSearch } from '@/components/employees/employee-advanced-search'
import { EmployeeImportDialog } from '@/components/employees/employee-import-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Users, UserCheck, UserX, Clock } from 'lucide-react'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ExportAllButton } from '@/components/employees/export-all-button'

async function getEmployeeStats() {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/employees/stats`, {
      cache: 'no-store'
    })
    if (response.ok) {
      return await response.json()
    }
  } catch (error) {
    console.error('Error fetching employee stats:', error)
  }
  return { total: 0, active: 0, onLeave: 0, inactive: 0 }
}

async function getDepartments() {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/departments`, {
      cache: 'no-store'
    })
    if (response.ok) {
      const data = await response.json()
      return Array.isArray(data.departments) ? data.departments : []
    }
  } catch (error) {
    console.error('Error fetching departments:', error)
  }
  return []
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Check user permissions
  if (!session.user.role || !['ADMIN', 'HR', 'MANAGER'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  const canCreateEmployee = ['ADMIN', 'HR'].includes(session.user.role)
  
  // Fetch data in parallel
  const [stats, departments, params] = await Promise.all([
    getEmployeeStats(),
    getDepartments(),
    searchParams
  ])

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
            <>
              <EmployeeImportDialog />
              <ExportAllButton />
              <Link href="/dashboard/employees/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </Link>
            </>
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

      {/* Employee Directory with Integrated Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Directory
          </CardTitle>
          <CardDescription>
            Search, filter, and manage employee profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Integrated Search Component */}
          <Suspense fallback={<div>Loading search...</div>}>
            <EmployeeAdvancedSearch departments={departments} />
          </Suspense>
          
          {/* Employee List */}
          <Suspense fallback={<div>Loading employees...</div>}>
            <EmployeeList searchParams={params} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
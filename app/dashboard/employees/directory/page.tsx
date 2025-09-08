import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EmployeeDirectory } from '@/components/employees/employee-directory'
import { OrganizationalChart } from '@/components/employees/organizational-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Network } from 'lucide-react'

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

async function getDesignations() {
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { designation: true },
    distinct: ['designation'],
    orderBy: { designation: 'asc' }
  })
  
  return employees.map(emp => emp.designation)
}

export default async function EmployeeDirectoryPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Check if user has permission to view employee directory
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { employee: true }
  })

  if (!currentUser) {
    redirect('/dashboard')
  }

  const [departments, designations] = await Promise.all([
    getDepartments(),
    getDesignations()
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Directory</h1>
          <p className="text-muted-foreground">
            Browse employee profiles and organizational structure
          </p>
        </div>
      </div>

      {/* Directory and Org Chart Tabs */}
      <Tabs defaultValue="directory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="directory" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Directory
          </TabsTrigger>
          <TabsTrigger value="org-chart" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Org Chart
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Directory</CardTitle>
              <CardDescription>
                Search and browse employee profiles with advanced filtering
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Loading directory...</div>}>
                <EmployeeDirectory 
                  searchParams={searchParams}
                  departments={departments}
                  designations={designations}
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="org-chart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organizational Chart</CardTitle>
              <CardDescription>
                Visual representation of the organizational hierarchy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Loading organizational chart...</div>}>
                <OrganizationalChart />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
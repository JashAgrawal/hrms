import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { NewOnboardingWorkflow } from '@/components/employees/new-onboarding-workflow'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

async function getEmployeesWithoutOnboarding() {
  return await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      onboardingWorkflow: null // Employees without existing onboarding workflow
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      designation: true,
      joiningDate: true,
      department: {
        select: {
          name: true
        }
      }
    },
    orderBy: { joiningDate: 'desc' }
  })
}

async function getActiveTemplates() {
  return await prisma.onboardingTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      _count: {
        select: {
          tasks: true
        }
      }
    },
    orderBy: { name: 'asc' }
  })
}

async function getHRUsers() {
  return await prisma.user.findMany({
    where: {
      role: { in: ['HR', 'ADMIN'] },
      isActive: true
    },
    select: {
      id: true,
      name: true,
      email: true
    },
    orderBy: { name: 'asc' }
  })
}

export default async function NewOnboardingWorkflowPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
    redirect('/dashboard/employees/onboarding')
  }

  const [employees, templates, hrUsers] = await Promise.all([
    getEmployeesWithoutOnboarding(),
    getActiveTemplates(),
    getHRUsers()
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/employees/onboarding">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Onboarding
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Start New Onboarding</h1>
          <p className="text-muted-foreground">
            Create a new onboarding workflow for an employee
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Workflow Setup</CardTitle>
          <CardDescription>
            Select an employee and template to start the onboarding process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewOnboardingWorkflow
            employees={employees}
            templates={templates}
            hrUsers={hrUsers}
          />
        </CardContent>
      </Card>
    </div>
  )
}
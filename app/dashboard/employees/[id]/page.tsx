import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EmployeeProfile } from '@/components/employees/employee-profile'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit } from 'lucide-react'
import Link from 'next/link'

async function getEmployee(id: string) {
  return await prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
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
          designation: true,
        }
      },
      subordinates: {
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          designation: true,
          status: true,
        }
      },
      attendanceRecords: {
        take: 10,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          checkIn: true,
          checkOut: true,
          status: true,
          workHours: true,
        }
      },
      leaveRequests: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          days: true,
          status: true,
          reason: true,
          policy: {
            select: {
              name: true,
              type: true,
            }
          }
        }
      },
      documents: {
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          category: true,
          fileName: true,
          fileSize: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  })
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth();
  const { id } = await params
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const employee = await getEmployee(id)
  
  if (!employee) {
    notFound()
  }

  // Check if user can view this employee
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { employee: true }
  })

  const canView = 
    ['ADMIN', 'HR'].includes(currentUser?.role || '') ||
    currentUser?.employee?.id === employee.id ||
    currentUser?.employee?.id === employee.reportingTo

  if (!canView) {
    redirect('/dashboard')
  }

  const canEdit = 
    ['ADMIN', 'HR'].includes(currentUser?.role || '') ||
    currentUser?.employee?.id === employee.id

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/employees">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Employees
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-muted-foreground">
              {employee.employeeCode} • {employee.designation}
            </p>
          </div>
        </div>
        
        {canEdit && (
          <Link href={`/dashboard/employees/${employee.id}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </Link>
        )}
      </div>

      {/* Employee Profile */}
      <EmployeeProfile employee={{
        ...employee,
        address: employee.address as Record<string, unknown> | undefined,
        basicSalary: employee.basicSalary ? Number(employee.basicSalary) : undefined,
        ctc: employee.ctc ? Number(employee.ctc) : undefined,
        employeeType: employee.employeeType as string,
        attendanceRecords: employee.attendanceRecords.map(record => ({
          ...record,
          status: record.status as string,
          workHours: record.workHours ? Number(record.workHours) : undefined,
        })),
        leaveRequests: employee.leaveRequests.map(leave => ({
          ...leave,
          days: Number(leave.days),
          policy: {
            ...leave.policy,
            type: leave.policy.type as string,
          }
        })),
      }} />
    </div>
  )
}
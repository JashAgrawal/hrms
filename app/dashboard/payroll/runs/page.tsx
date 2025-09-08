'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { PayrollRunList } from '@/components/payroll/payroll-run-list'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface PayrollRun {
  id: string
  period: string
  startDate: string
  endDate: string
  status: 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  processedAt?: string
  processedBy?: string
  totalGross?: number
  totalNet?: number
  totalDeductions?: number
  employeeCount?: number
  createdAt: string
  updatedAt: string
  _count: {
    payrollRecords: number
  }
}

export default function PayrollRunsPage() {
  const { data: session, status } = useSession()
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPayrollRuns()
  }, [])

  // Redirect if not authenticated or doesn't have permission
  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  const fetchPayrollRuns = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/payroll/runs')
      if (response.ok) {
        const data = await response.json()
        setPayrollRuns(data.payrollRuns || [])
      } else {
        console.error('Failed to fetch payroll runs')
      }
    } catch (error) {
      console.error('Error fetching payroll runs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleView = (run: PayrollRun) => {
    // Navigate to payroll run details page
    window.location.href = `/dashboard/payroll/runs/${run.id}`
  }

  const handleDelete = async (runId: string) => {
    try {
      const response = await fetch(`/api/payroll/runs/${runId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchPayrollRuns() // Refresh the list
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete payroll run')
      }
    } catch (error) {
      console.error('Error deleting payroll run:', error)
      throw error
    }
  }

  const handleCreate = () => {
    // Navigate to create payroll run page
    window.location.href = '/dashboard/payroll/runs/new'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading payroll runs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/dashboard/payroll">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Payroll
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-4">Payroll Runs</h1>
          <p className="text-gray-600">
            Manage and process monthly payroll runs for all employees
          </p>
        </div>
      </div>

      {/* Payroll Runs List */}
      <PayrollRunList
        payrollRuns={payrollRuns}
        onView={handleView}
        onDelete={handleDelete}
        onCreate={handleCreate}
        isLoading={isLoading}
      />
    </div>
  )
}
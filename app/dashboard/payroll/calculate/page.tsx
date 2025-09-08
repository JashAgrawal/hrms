'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { PayrollCalculator } from '@/components/payroll/payroll-calculator'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  designation: string
  department: {
    name: string
  }
}

export default function PayrollCalculatePage() {
  const { data: session, status } = useSession()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchEmployees()
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

  const fetchEmployees = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/employees?status=ACTIVE')
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      } else {
        console.error('Failed to fetch employees')
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCalculationComplete = (result: any) => {
    console.log('Payroll calculation completed:', result)
    // You could show a success message or redirect to results page
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading employees...</p>
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
          <h1 className="text-3xl font-bold tracking-tight mt-4">Payroll Calculator</h1>
          <p className="text-gray-600">
            Calculate payroll for individual employees and preview salary breakdowns
          </p>
        </div>
      </div>

      {/* Payroll Calculator */}
      <PayrollCalculator
        employees={employees}
        onCalculationComplete={handleCalculationComplete}
      />
    </div>
  )
}
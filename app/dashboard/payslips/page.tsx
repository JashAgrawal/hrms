'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import EmployeePayslips from '@/components/payroll/employee-payslips'

export default function PayslipsPage() {
  const { data: session, status } = useSession()

  // Redirect if not authenticated
  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const handleViewPayslip = (payslipId: string) => {
    // Open payslip in new tab
    window.open(`/api/payroll/payslips/${payslipId}?format=html`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Payslips</h1>
        <p className="text-gray-600">
          View and download your salary slips
        </p>
      </div>

      {/* Payslips Component */}
      <EmployeePayslips onViewPayslip={handleViewPayslip} />
    </div>
  )
}
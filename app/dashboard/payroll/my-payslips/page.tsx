import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import EmployeePayslips from '@/components/payroll/employee-payslips'

export default async function MyPayslipsPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <div className="container mx-auto py-6">
      <EmployeePayslips />
    </div>
  )
}
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ExpensesDashboard } from '@/components/expenses/expenses-dashboard'

export default async function ExpensesPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      }>
        <ExpensesDashboard />
      </Suspense>
    </div>
  )
}
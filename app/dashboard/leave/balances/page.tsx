import { Metadata } from 'next'
import { LeaveBalanceManagement } from '@/components/leave/leave-balance-management'

export const metadata: Metadata = {
  title: 'Leave Balances | Pekka HR',
  description: 'Monitor and manage employee leave balances',
}

export default function LeaveBalancesPage() {
  return <LeaveBalanceManagement />
}
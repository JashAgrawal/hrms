import { Metadata } from 'next'
import { LeaveDashboard } from '@/components/leave/leave-dashboard'

export const metadata: Metadata = {
  title: 'Leave Management | Pekka HR',
  description: 'Comprehensive leave management dashboard',
}

export default function LeaveManagementPage() {
  return <LeaveDashboard />
}
import { Metadata } from 'next'
import { LeaveRequestList } from '@/components/leave/leave-request-list'

export const metadata: Metadata = {
  title: 'Leave Requests | Pekka HR',
  description: 'Manage and track leave requests',
}

export default function LeaveRequestsPage() {
  return <LeaveRequestList />
}
import { Metadata } from 'next'
import { LeavePolicyList } from '@/components/leave/leave-policy-list'

export const metadata: Metadata = {
  title: 'Leave Policies | Pekka HR',
  description: 'Manage leave policies and configurations',
}

export default function LeavePoliciesPage() {
  return <LeavePolicyList />
}
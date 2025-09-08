import { Metadata } from 'next'
import { LeaveCalendar } from '@/components/leave/leave-calendar'

export const metadata: Metadata = {
  title: 'Leave Calendar | Pekka HR',
  description: 'View team leave schedules and availability',
}

export default function LeaveCalendarPage() {
  return <LeaveCalendar />
}
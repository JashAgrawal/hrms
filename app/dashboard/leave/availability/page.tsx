import { Metadata } from 'next'
import { TeamAvailability } from '@/components/leave/team-availability'

export const metadata: Metadata = {
  title: 'Team Availability | Pekka HR',
  description: 'Monitor team availability and plan resource allocation',
}

export default function TeamAvailabilityPage() {
  return <TeamAvailability />
}
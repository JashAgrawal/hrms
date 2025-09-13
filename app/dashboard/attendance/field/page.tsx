import { redirect } from 'next/navigation'

export default function FieldAttendancePage() {
  // Redirect to main attendance page since field functionality is now integrated
  redirect('/dashboard/attendance')
}
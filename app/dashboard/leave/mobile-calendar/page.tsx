import { Metadata } from 'next'
import { MobileAttendanceCalendar } from '@/components/leave/mobile-attendance-calendar'

export const metadata: Metadata = {
  title: 'Mobile Calendar | Pekka HR',
  description: 'Mobile-friendly attendance and leave calendar view',
}

export default function MobileCalendarPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="container mx-auto px-4">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-600 text-sm mt-1">
            View your attendance and leave calendar
          </p>
        </div>
        
        <MobileAttendanceCalendar />
      </div>
    </div>
  )
}
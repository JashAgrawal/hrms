import { Suspense } from 'react'
import { FieldEmployeeCheckin } from '@/components/attendance/field-employee-checkin'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

export default function FieldAttendancePage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Field Attendance</h1>
        <p className="text-gray-600 mt-2">
          Check in and out of assigned sites during your field visits
        </p>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <FieldEmployeeCheckin />
      </Suspense>
    </div>
  )
}
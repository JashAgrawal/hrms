import { Suspense } from 'react'
import { SiteVisitsDashboard } from '@/components/sites/site-visits-dashboard'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

export default function SiteVisitsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Site Visits</h1>
        <p className="text-gray-600 mt-2">
          Monitor field employee site visits and attendance tracking
        </p>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <SiteVisitsDashboard />
      </Suspense>
    </div>
  )
}
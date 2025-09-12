import { Suspense } from 'react'
import { SiteManagement } from '@/components/sites/site-management'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

export default function SitesPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Site Management</h1>
        <p className="text-gray-600 mt-2">
          Manage sites for field employee attendance tracking
        </p>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <SiteManagement />
      </Suspense>
    </div>
  )
}
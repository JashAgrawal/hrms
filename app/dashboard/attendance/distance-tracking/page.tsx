import { Metadata } from 'next'
import { DistanceTrackingDashboard } from '@/components/attendance/distance-tracking-dashboard'

export const metadata: Metadata = {
  title: 'Distance Tracking | Pekka HR',
  description: 'Track and analyze field employee travel distances and routes',
}

export default function DistanceTrackingPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Distance Tracking</h1>
          <p className="text-muted-foreground">
            Monitor field employee travel distances, routes, and detect movement anomalies
          </p>
        </div>
        
        <DistanceTrackingDashboard />
      </div>
    </div>
  )
}
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { OKRDashboard } from '@/components/performance/okr-dashboard'
import { FeedbackDashboard } from '@/components/performance/feedback-dashboard'
import { ReviewCycleDashboard } from '@/components/performance/review-cycle-dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Target, Users, TrendingUp, Award } from 'lucide-react'

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </CardHeader>
        <CardContent className="animate-pulse">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function PerformancePage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Management</h1>
          <p className="text-gray-600 mt-1">
            Track objectives, key results, and performance reviews
          </p>
        </div>
      </div>

      {/* Performance Tabs */}
      <Tabs defaultValue="okrs" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="okrs" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            OKRs
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            360° Feedback
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="okrs">
          <Suspense fallback={<LoadingSkeleton />}>
            <OKRDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="reviews">
          <Suspense fallback={<LoadingSkeleton />}>
            <ReviewCycleDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="feedback">
          <Suspense fallback={<LoadingSkeleton />}>
            <FeedbackDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>
                View performance trends and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Performance Analytics
                </h3>
                <p className="text-gray-600 mb-4">
                  Analytics and reporting functionality will be available soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
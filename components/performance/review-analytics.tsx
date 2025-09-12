'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  Target
} from 'lucide-react'

interface AnalyticsData {
  totalCycles: number
  activeCycles: number
  completedCycles: number
  totalReviews: number
  completedReviews: number
  averageRating: number
  cycleCompletionRate: number
  reviewCompletionRate: number
  upcomingDeadlines: any[]
  performanceTrends: any[]
}

export function ReviewAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      // In a real implementation, this would fetch from an analytics API
      // For now, we'll simulate the data
      setTimeout(() => {
        setAnalytics({
          totalCycles: 8,
          activeCycles: 2,
          completedCycles: 5,
          totalReviews: 156,
          completedReviews: 142,
          averageRating: 4.2,
          cycleCompletionRate: 87.5,
          reviewCompletionRate: 91.0,
          upcomingDeadlines: [
            { name: 'Q4 2024 Reviews', dueDate: '2024-12-31', reviewsCount: 45 },
            { name: 'Annual Reviews 2024', dueDate: '2025-01-15', reviewsCount: 78 }
          ],
          performanceTrends: [
            { period: 'Q1 2024', avgRating: 4.1, completionRate: 89 },
            { period: 'Q2 2024', avgRating: 4.3, completionRate: 92 },
            { period: 'Q3 2024', avgRating: 4.2, completionRate: 88 },
            { period: 'Q4 2024', avgRating: 4.4, completionRate: 94 }
          ]
        })
        setLoading(false)
      }, 1000)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data</h3>
        <p className="text-gray-600">Analytics data will appear here once reviews are completed</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cycle Completion</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.cycleCompletionRate}%</div>
            <p className="text-xs text-gray-600">
              {analytics.completedCycles} of {analytics.totalCycles} cycles
            </p>
            <Progress value={analytics.cycleCompletionRate} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Review Completion</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.reviewCompletionRate}%</div>
            <p className="text-xs text-gray-600">
              {analytics.completedReviews} of {analytics.totalReviews} reviews
            </p>
            <Progress value={analytics.reviewCompletionRate} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageRating}/5</div>
            <p className="text-xs text-gray-600">across all reviews</p>
            <div className="flex items-center mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <div
                  key={star}
                  className={`h-2 w-2 rounded-full mr-1 ${
                    star <= analytics.averageRating ? 'bg-yellow-400' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cycles</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.activeCycles}</div>
            <p className="text-xs text-gray-600">currently running</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
          <CardDescription>
            Review completion rates and average ratings over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.performanceTrends.map((trend, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-sm font-medium">{trend.period}</div>
                  <Badge variant="outline">
                    Rating: {trend.avgRating}/5
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">{trend.completionRate}%</div>
                    <div className="text-xs text-gray-600">completion</div>
                  </div>
                  <Progress value={trend.completionRate} className="w-24 h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Deadlines */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Deadlines</CardTitle>
          <CardDescription>
            Review cycles with approaching due dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.upcomingDeadlines.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No upcoming deadlines</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.upcomingDeadlines.map((deadline, index) => {
                const dueDate = new Date(deadline.dueDate)
                const now = new Date()
                const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                const isOverdue = daysUntilDue < 0
                const isUrgent = daysUntilDue <= 7 && daysUntilDue >= 0

                return (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {isOverdue ? (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      ) : isUrgent ? (
                        <Clock className="h-5 w-5 text-orange-600" />
                      ) : (
                        <Calendar className="h-5 w-5 text-blue-600" />
                      )}
                      <div>
                        <div className="font-medium">{deadline.name}</div>
                        <div className="text-sm text-gray-600">
                          {deadline.reviewsCount} reviews • Due {dueDate.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge 
                      className={
                        isOverdue 
                          ? 'bg-red-100 text-red-800'
                          : isUrgent 
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }
                    >
                      {isOverdue 
                        ? `${Math.abs(daysUntilDue)} days overdue`
                        : `${daysUntilDue} days left`
                      }
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
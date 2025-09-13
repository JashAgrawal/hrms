'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users,
  Calendar,
  Clock
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface LeaveAnalytics {
  totalRequests: number
  approvalRate: number
  averageProcessingTime: number
  mostUsedLeaveType: {
    name: string
    count: number
    percentage: number
  }
  monthlyTrend: {
    month: string
    requests: number
    approved: number
  }[]
  departmentUsage: {
    department: string
    usage: number
    percentage: number
  }[]
  upcomingPeaks: {
    date: string
    count: number
  }[]
}

export function LeaveAnalyticsCard() {
  const [analytics, setAnalytics] = useState<LeaveAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leave/dashboard/analytics')
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      } else {
        throw new Error('Failed to fetch analytics')
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast({
        title: 'Error',
        description: 'Failed to load analytics',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <CardTitle>Leave Analytics</CardTitle>
          </div>
          <CardDescription>Organization-wide leave insights</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <CardTitle>Leave Analytics</CardTitle>
          </div>
          <CardDescription>Organization-wide leave insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No analytics data available
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <CardTitle>Leave Analytics</CardTitle>
          </div>
          <Link href="/dashboard/leave/reports">
            <Button variant="ghost" size="sm">
              Full Reports
            </Button>
          </Link>
        </div>
        <CardDescription>Organization-wide leave insights</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{analytics.totalRequests}</div>
            <div className="text-xs text-muted-foreground">Total Requests</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              {analytics.approvalRate >= 80 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="text-2xl font-bold">{analytics.approvalRate}%</div>
            <div className="text-xs text-muted-foreground">Approval Rate</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{analytics.averageProcessingTime}</div>
            <div className="text-xs text-muted-foreground">Avg. Processing (days)</div>
          </div>
        </div>

        {/* Most Used Leave Type */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Most Popular Leave Type</h4>
          <div className="flex items-center justify-between">
            <span className="text-sm">{analytics.mostUsedLeaveType.name}</span>
            <span className="text-sm font-medium">
              {analytics.mostUsedLeaveType.count} requests ({analytics.mostUsedLeaveType.percentage}%)
            </span>
          </div>
          <Progress value={analytics.mostUsedLeaveType.percentage} className="h-2" />
        </div>

        {/* Department Usage */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Department Usage</h4>
          {analytics.departmentUsage.slice(0, 4).map((dept, index) => (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{dept.department}</span>
                <span className="font-medium">{dept.usage} days ({dept.percentage}%)</span>
              </div>
              <Progress value={dept.percentage} className="h-1.5" />
            </div>
          ))}
        </div>

        {/* Monthly Trend */}
        {analytics.monthlyTrend.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Recent Trend</h4>
            <div className="flex items-end gap-2 h-16">
              {analytics.monthlyTrend.slice(-6).map((month, index) => {
                const maxRequests = Math.max(...analytics.monthlyTrend.map(m => m.requests))
                const height = (month.requests / maxRequests) * 100
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-primary/20 rounded-t"
                      style={{ height: `${height}%` }}
                      title={`${month.month}: ${month.requests} requests, ${month.approved} approved`}
                    >
                      <div 
                        className="w-full bg-primary rounded-t"
                        style={{ height: `${(month.approved / month.requests) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {month.month.slice(0, 3)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Requests</span>
              <span>Approved</span>
            </div>
          </div>
        )}

        {/* Upcoming Peaks */}
        {analytics.upcomingPeaks.length > 0 && (
          <div className="space-y-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="text-sm font-medium text-orange-800">Upcoming Leave Peaks</h4>
            <div className="space-y-1">
              {analytics.upcomingPeaks.slice(0, 2).map((peak, index) => (
                <div key={index} className="flex justify-between text-sm text-orange-700">
                  <span>{peak.date}</span>
                  <span>{peak.count} employees</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

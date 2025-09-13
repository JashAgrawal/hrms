'use client'

import { useState, useEffect } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText,
  User,
  Calendar
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'

interface ActivityItem {
  id: string
  type: 'REQUEST_SUBMITTED' | 'REQUEST_APPROVED' | 'REQUEST_REJECTED' | 'REQUEST_CANCELLED' | 'BALANCE_UPDATED'
  title: string
  description: string
  timestamp: string
  user?: {
    firstName: string
    lastName: string
  }
  leaveRequest?: {
    id: string
    policy: {
      name: string
    }
    startDate: string
    endDate: string
    days: number
  }
}

export function RecentActivityCard() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { hasRole } = usePermissions()

  const isEmployee = hasRole('EMPLOYEE')

  useEffect(() => {
    fetchRecentActivity()
  }, [])

  const fetchRecentActivity = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leave/dashboard/recent-activity')
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      } else {
        throw new Error('Failed to fetch recent activity')
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error)
      toast({
        title: 'Error',
        description: 'Failed to load recent activity',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'REQUEST_SUBMITTED':
        return <FileText className="h-4 w-4 text-blue-500" />
      case 'REQUEST_APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'REQUEST_REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'REQUEST_CANCELLED':
        return <XCircle className="h-4 w-4 text-orange-500" />
      case 'BALANCE_UPDATED':
        return <Calendar className="h-4 w-4 text-purple-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getActivityBadgeColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'REQUEST_SUBMITTED':
        return 'bg-blue-100 text-blue-800'
      case 'REQUEST_APPROVED':
        return 'bg-green-100 text-green-800'
      case 'REQUEST_REJECTED':
        return 'bg-red-100 text-red-800'
      case 'REQUEST_CANCELLED':
        return 'bg-orange-100 text-orange-800'
      case 'BALANCE_UPDATED':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle>Recent Activity</CardTitle>
          </div>
          <CardDescription>
            {isEmployee ? "Your recent leave activities" : "Recent team activities"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle>Recent Activity</CardTitle>
          </div>
          <CardDescription>
            {isEmployee ? "Your recent leave activities" : "Recent team activities"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No recent activity to display
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <CardTitle>Recent Activity</CardTitle>
        </div>
        <CardDescription>
          {isEmployee ? "Your recent leave activities" : "Recent team activities"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.slice(0, 5).map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-muted">
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium leading-tight">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.description}
                  </p>
                  {activity.user && !isEmployee && (
                    <div className="flex items-center gap-1 mt-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {activity.user.firstName} {activity.user.lastName}
                      </span>
                    </div>
                  )}
                  {activity.leaveRequest && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {activity.leaveRequest.policy.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(activity.leaveRequest.startDate), 'MMM dd')}
                        {activity.leaveRequest.startDate !== activity.leaveRequest.endDate && 
                          ` - ${format(new Date(activity.leaveRequest.endDate), 'MMM dd')}`
                        } ({activity.leaveRequest.days} day{activity.leaveRequest.days !== 1 ? 's' : ''})
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getActivityBadgeColor(activity.type)}`}
                  >
                    {activity.type.replace('_', ' ').toLowerCase()}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {activities.length > 5 && (
          <div className="text-center pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Showing 5 of {activities.length} activities
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

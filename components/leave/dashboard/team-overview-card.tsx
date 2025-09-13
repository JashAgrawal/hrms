'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Users, 
  Calendar, 
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface TeamMember {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  isOnLeave: boolean
  leaveEndDate?: string
  upcomingLeaves: number
}

interface TeamStats {
  totalMembers: number
  onLeaveToday: number
  onLeaveThisWeek: number
  availabilityPercentage: number
  upcomingLeaves: number
  criticalCoverage: boolean
}

export function TeamOverviewCard() {
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchTeamOverview()
  }, [])

  const fetchTeamOverview = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leave/dashboard/team-overview')
      if (response.ok) {
        const data = await response.json()
        setTeamStats(data.stats)
        setTeamMembers(data.members || [])
      } else {
        throw new Error('Failed to fetch team overview')
      }
    } catch (error) {
      console.error('Error fetching team overview:', error)
      toast({
        title: 'Error',
        description: 'Failed to load team overview',
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
            <Users className="h-5 w-5" />
            <CardTitle>Team Overview</CardTitle>
          </div>
          <CardDescription>Current team availability status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-8" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-8" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!teamStats) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Team Overview</CardTitle>
          </div>
          <CardDescription>Current team availability status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No team data available
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
            <Users className="h-5 w-5" />
            <CardTitle>Team Overview</CardTitle>
            {teamStats.criticalCoverage && (
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            )}
          </div>
          <Link href="/dashboard/leave/availability">
            <Button variant="ghost" size="sm">
              View Details
            </Button>
          </Link>
        </div>
        <CardDescription>Current team availability status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Availability Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Team Availability</span>
            <span className="text-sm font-bold text-green-600">
              {teamStats.availabilityPercentage}%
            </span>
          </div>
          <Progress 
            value={teamStats.availabilityPercentage} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {teamStats.totalMembers - teamStats.onLeaveToday} available
            </span>
            <span>
              {teamStats.onLeaveToday} on leave
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold text-orange-600">
              {teamStats.onLeaveThisWeek}
            </div>
            <div className="text-xs text-muted-foreground">
              This week
            </div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold text-blue-600">
              {teamStats.upcomingLeaves}
            </div>
            <div className="text-xs text-muted-foreground">
              Upcoming
            </div>
          </div>
        </div>

        {/* Team Members Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Team Status</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {teamMembers.slice(0, 5).map((member) => (
              <div key={member.id} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    member.isOnLeave ? 'bg-red-500' : 'bg-green-500'
                  }`} />
                  <span className="font-medium">
                    {member.firstName} {member.lastName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {member.isOnLeave ? (
                    <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">
                      On Leave
                      {member.leaveEndDate && (
                        <span className="ml-1">
                          until {format(new Date(member.leaveEndDate), 'MMM dd')}
                        </span>
                      )}
                    </Badge>
                  ) : member.upcomingLeaves > 0 ? (
                    <Badge variant="outline" className="text-xs">
                      {member.upcomingLeaves} upcoming
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                      Available
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {teamMembers.length > 5 && (
            <div className="text-center pt-2 border-t">
              <Link href="/dashboard/leave/availability">
                <Button variant="outline" size="sm">
                  View all {teamMembers.length} members
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Critical Coverage Warning */}
        {teamStats.criticalCoverage && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">
                Critical Coverage Alert
              </span>
            </div>
            <p className="text-xs text-orange-700 mt-1">
              Team availability is below recommended levels. Consider reviewing upcoming leave requests.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

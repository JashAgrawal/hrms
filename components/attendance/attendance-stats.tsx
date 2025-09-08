'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Calendar, TrendingUp, Target } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'

interface AttendanceStats {
  todayStatus: string
  thisWeek: {
    present: number
    total: number
    hours: number
    overtime: number
  }
  thisMonth: {
    present: number
    total: number
    hours: number
    overtime: number
    lateCount: number
  }
  averageHours: number
}

export function AttendanceStats() {
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      // Get current month data
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
      
      const monthResponse = await fetch(`/api/attendance?startDate=${monthStart}&endDate=${monthEnd}&limit=100`)
      
      // Get current week data
      const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd')
      const weekEnd = format(endOfWeek(new Date()), 'yyyy-MM-dd')
      
      const weekResponse = await fetch(`/api/attendance?startDate=${weekStart}&endDate=${weekEnd}&limit=50`)
      
      // Get today's status
      const statusResponse = await fetch('/api/attendance/status')

      if (monthResponse.ok && weekResponse.ok && statusResponse.ok) {
        const monthData = await monthResponse.json()
        const weekData = await weekResponse.json()
        const statusData = await statusResponse.json()

        const monthRecords = monthData.records || []
        const weekRecords = weekData.records || []

        // Calculate stats
        const monthPresent = monthRecords.filter((r: any) => 
          ['PRESENT', 'LATE', 'WORK_FROM_HOME'].includes(r.status)
        ).length
        
        const weekPresent = weekRecords.filter((r: any) => 
          ['PRESENT', 'LATE', 'WORK_FROM_HOME'].includes(r.status)
        ).length

        const monthHours = monthRecords.reduce((sum: number, r: any) => sum + (r.workHours || 0), 0)
        const weekHours = weekRecords.reduce((sum: number, r: any) => sum + (r.workHours || 0), 0)
        
        const monthOvertime = monthRecords.reduce((sum: number, r: any) => sum + (r.overtime || 0), 0)
        const weekOvertime = weekRecords.reduce((sum: number, r: any) => sum + (r.overtime || 0), 0)
        
        const lateCount = monthRecords.filter((r: any) => r.status === 'LATE').length
        
        const averageHours = monthPresent > 0 ? monthHours / monthPresent : 0

        setStats({
          todayStatus: statusData.status || 'NOT_MARKED',
          thisWeek: {
            present: weekPresent,
            total: weekRecords.length,
            hours: weekHours,
            overtime: weekOvertime
          },
          thisMonth: {
            present: monthPresent,
            total: monthRecords.length,
            hours: monthHours,
            overtime: monthOvertime,
            lateCount
          },
          averageHours
        })
      }
    } catch (error) {
      console.error('Error fetching attendance stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const getAttendanceRate = (present: number, total: number) => {
    if (total === 0) return 0
    return Math.round((present / total) * 100)
  }

  const getTodayStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
      case 'WORK_FROM_HOME':
        return 'text-green-600'
      case 'LATE':
        return 'text-yellow-600'
      case 'ABSENT':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <>
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </>
    )
  }

  if (!stats) {
    return (
      <div className="col-span-4 text-center py-8 text-muted-foreground">
        Failed to load attendance statistics
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Status</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getTodayStatusColor(stats.todayStatus)}`}>
            {stats.todayStatus.replace('_', ' ')}
          </div>
          <p className="text-xs text-muted-foreground">
            Current attendance status
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.thisWeek.present}/{Math.max(stats.thisWeek.total, 5)}
          </div>
          <p className="text-xs text-muted-foreground">
            {getAttendanceRate(stats.thisWeek.present, Math.max(stats.thisWeek.total, 5))}% attendance rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.thisMonth.present}/{Math.max(stats.thisMonth.total, 22)}
          </div>
          <p className="text-xs text-muted-foreground">
            {getAttendanceRate(stats.thisMonth.present, Math.max(stats.thisMonth.total, 22))}% attendance rate
          </p>
          {stats.thisMonth.lateCount > 0 && (
            <p className="text-xs text-yellow-600 mt-1">
              {stats.thisMonth.lateCount} late arrivals
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Hours</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatHours(stats.averageHours)}
          </div>
          <p className="text-xs text-muted-foreground">
            Per working day
          </p>
          {stats.thisMonth.overtime > 0 && (
            <p className="text-xs text-orange-600 mt-1">
              +{formatHours(stats.thisMonth.overtime)} overtime
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
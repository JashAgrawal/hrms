"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, Clock, TrendingUp, TrendingDown } from "lucide-react"
import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"

interface LeaveBalance {
  type: string
  allocated: number
  used: number
  remaining: number
  carryForward?: number
}

interface RecentLeave {
  id: string
  type: string
  startDate: string
  endDate: string
  days: number
  status: 'APPROVED' | 'PENDING' | 'REJECTED'
}

interface LeaveStats {
  totalAllocated: number
  totalUsed: number
  totalRemaining: number
  utilizationRate: number
  balances: LeaveBalance[]
  recentLeaves: RecentLeave[]
}

export function LeaveReportCard() {
  const [leaveStats, setLeaveStats] = useState<LeaveStats>({
    totalAllocated: 0,
    totalUsed: 0,
    totalRemaining: 0,
    utilizationRate: 0,
    balances: [],
    recentLeaves: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaveData = async () => {
      try {
        // Fetch leave balances
        const balanceResponse = await fetch('/api/leave/balances')
        let balances: LeaveBalance[] = []
        
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json()
          balances = balanceData.balances || []
        } else {
          console.error('Failed to fetch leave balances:', balanceResponse.status)
          balances = []
        }

        // Fetch recent leave requests
        const leaveResponse = await fetch('/api/leave/requests?limit=5&recent=true')
        let recentLeaves: RecentLeave[] = []
        
        if (leaveResponse.ok) {
          const leaveData = await leaveResponse.json()
          recentLeaves = (leaveData.requests || []).map((request: any) => ({
            id: request.id,
            type: request.type,
            startDate: request.startDate,
            endDate: request.endDate,
            days: request.days || 1,
            status: request.status
          }))
        } else {
          console.error('Failed to fetch recent leaves:', leaveResponse.status)
          recentLeaves = []
        }

        // Calculate totals
        const totalAllocated = balances.reduce((sum, b) => sum + b.allocated, 0)
        const totalUsed = balances.reduce((sum, b) => sum + b.used, 0)
        const totalRemaining = balances.reduce((sum, b) => sum + b.remaining, 0)
        const utilizationRate = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0

        setLeaveStats({
          totalAllocated,
          totalUsed,
          totalRemaining,
          utilizationRate,
          balances,
          recentLeaves
        })
      } catch (error) {
        console.error('Failed to fetch leave data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaveData()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>
      case 'PENDING':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'REJECTED':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return format(start, 'MMM dd')
    }
    
    return `${format(start, 'MMM dd')} - ${format(end, 'MMM dd')}`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Leave Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-2 bg-gray-200 rounded w-full"></div>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Leave Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Leave Balance</span>
            <span className="text-lg font-semibold">{leaveStats.totalRemaining} days</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>Used: {leaveStats.totalUsed}</span>
              <span>Remaining: {leaveStats.totalRemaining}</span>
            </div>
            <Progress 
              value={leaveStats.utilizationRate} 
              className="h-2"
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {leaveStats.utilizationRate >= 50 ? (
                <TrendingUp className="h-3 w-3 text-orange-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-green-600" />
              )}
              <span>{leaveStats.utilizationRate.toFixed(1)}% utilized</span>
            </div>
          </div>
        </div>

        {/* Leave Type Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Leave Balances</h4>
          <div className="space-y-2">
            {leaveStats.balances.map((balance, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{balance.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {balance.remaining}/{balance.allocated}
                    </span>
                  </div>
                  <Progress 
                    value={(balance.used / balance.allocated) * 100} 
                    className="h-1 mt-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Leave History */}
        {leaveStats.recentLeaves.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Recent Leaves</h4>
            <div className="space-y-2">
              {leaveStats.recentLeaves.map((leave) => (
                <div key={leave.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{leave.type}</span>
                      {getStatusBadge(leave.status)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatDateRange(leave.startDate, leave.endDate)} ({leave.days} day{leave.days > 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-3 border-t">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-lg font-semibold text-blue-600">{leaveStats.totalRemaining}</p>
              <p className="text-xs text-muted-foreground">Days Available</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-green-600">
                {leaveStats.balances.find(b => b.carryForward)?.carryForward || 0}
              </p>
              <p className="text-xs text-muted-foreground">Carry Forward</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
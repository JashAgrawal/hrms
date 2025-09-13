'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Calendar, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface LeaveBalance {
  id: string
  allocated: number
  used: number
  pending: number
  available: number
  carriedForward: number
  policy: {
    name: string
    code: string
    type: string
  }
}

export function LeaveBalanceCard() {
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchLeaveBalances()
  }, [])

  const fetchLeaveBalances = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leave/balances/my-balances')
      if (response.ok) {
        const data = await response.json()
        setBalances(data.balances || [])
      } else {
        throw new Error('Failed to fetch leave balances')
      }
    } catch (error) {
      console.error('Error fetching leave balances:', error)
      toast({
        title: 'Error',
        description: 'Failed to load leave balances',
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
            <TrendingUp className="h-5 w-5" />
            <CardTitle>Leave Balances</CardTitle>
          </div>
          <CardDescription>Your current leave entitlements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full" />
              <div className="flex justify-between text-xs">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (balances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <CardTitle>Leave Balances</CardTitle>
          </div>
          <CardDescription>Your current leave entitlements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No leave balances found. Contact HR to set up your leave entitlements.
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
          <TrendingUp className="h-5 w-5" />
          <CardTitle>Leave Balances</CardTitle>
        </div>
        <CardDescription>Your current leave entitlements</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {balances.map((balance) => {
          const usagePercentage = balance.allocated > 0 ? (balance.used / balance.allocated) * 100 : 0
          const pendingPercentage = balance.allocated > 0 ? (balance.pending / balance.allocated) * 100 : 0
          
          return (
            <div key={balance.id} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{balance.policy.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {balance.policy.code}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {balance.available}/{balance.allocated}
                  </div>
                  <div className="text-xs text-muted-foreground">days</div>
                </div>
              </div>
              
              <div className="space-y-1">
                <Progress 
                  value={usagePercentage} 
                  className="h-2"
                />
                {balance.pending > 0 && (
                  <Progress 
                    value={pendingPercentage} 
                    className="h-1 opacity-60"
                  />
                )}
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>Used: {balance.used}</span>
                  {balance.pending > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Pending: {balance.pending}
                    </span>
                  )}
                </div>
                {balance.carriedForward > 0 && (
                  <span>Carried: {balance.carriedForward}</span>
                )}
              </div>
            </div>
          )
        })}
        
        <div className="pt-2 border-t">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Total Available</span>
            <span className="font-bold text-green-600">
              {balances.reduce((sum, balance) => sum + balance.available, 0)} days
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

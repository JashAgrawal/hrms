'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  User,
  Calendar,
  Eye,
  AlertCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PendingRequest {
  id: string
  employee: {
    firstName: string
    lastName: string
    employeeCode: string
  }
  policy: {
    name: string
    code: string
  }
  startDate: string
  endDate: string
  days: number
  reason: string
  submittedAt: string
  isUrgent?: boolean
}

export function PendingApprovalsCard() {
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchPendingApprovals()
  }, [])

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leave/dashboard/pending-approvals')
      if (response.ok) {
        const data = await response.json()
        setPendingRequests(data.requests || [])
      } else {
        throw new Error('Failed to fetch pending approvals')
      }
    } catch (error) {
      console.error('Error fetching pending approvals:', error)
      toast({
        title: 'Error',
        description: 'Failed to load pending approvals',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleQuickApproval = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      setApproving(requestId)
      const response = await fetch(`/api/leave/requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: 'Success',
          description: result.message,
        })
        fetchPendingApprovals() // Refresh the list
      } else {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${action.toLowerCase()} request`)
      }
    } catch (error) {
      console.error('Error processing approval:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process approval',
        variant: 'destructive',
      })
    } finally {
      setApproving(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Pending Approvals</CardTitle>
          </div>
          <CardDescription>Requests awaiting your approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 p-3 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-3 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (pendingRequests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Pending Approvals</CardTitle>
          </div>
          <CardDescription>Requests awaiting your approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No pending approvals. All caught up!
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
            <Clock className="h-5 w-5" />
            <CardTitle>Pending Approvals</CardTitle>
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length}
              </Badge>
            )}
          </div>
          <Link href="/dashboard/leave/requests?status=PENDING">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>
        <CardDescription>Requests awaiting your approval</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingRequests.slice(0, 3).map((request) => (
          <div key={request.id} className="space-y-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">
                    {request.employee.firstName} {request.employee.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.employee.employeeCode}
                  </p>
                </div>
                {request.isUrgent && (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                )}
              </div>
              <Badge variant="outline" className="text-xs">
                {request.policy.code}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span>
                  {format(new Date(request.startDate), 'MMM dd')}
                  {request.startDate !== request.endDate && 
                    ` - ${format(new Date(request.endDate), 'MMM dd')}`
                  }
                </span>
                <span className="text-muted-foreground">
                  ({request.days} day{request.days !== 1 ? 's' : ''})
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {request.reason}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => handleQuickApproval(request.id, 'APPROVE')}
                disabled={approving === request.id}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleQuickApproval(request.id, 'REJECT')}
                disabled={approving === request.id}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
              <Link href={`/dashboard/leave/requests/${request.id}`}>
                <Button size="sm" variant="ghost">
                  <Eye className="h-3 w-3 mr-1" />
                  Details
                </Button>
              </Link>
            </div>
          </div>
        ))}

        {pendingRequests.length > 3 && (
          <div className="text-center pt-2 border-t">
            <Link href="/dashboard/leave/requests?status=PENDING">
              <Button variant="outline" size="sm">
                View {pendingRequests.length - 3} more requests
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

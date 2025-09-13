'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Check, X, MapPin, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

interface AttendanceRequest {
  id: string
  employee: { id: string; firstName: string; lastName: string; employeeCode: string; department?: { name: string } }
  date: string
  checkInTime: string
  location?: { latitude: number; longitude: number; accuracy?: number }
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export default function AttendanceRequestsPage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<AttendanceRequest[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/attendance/request?status=PENDING')
      if (!res.ok) throw new Error('Failed to fetch attendance requests')
      const data = await res.json()
      setRequests(data.requests || [])
    } catch (e) {
      console.error(e)
      toast({ title: 'Error', description: 'Failed to fetch attendance requests', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const act = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch(`/api/attendance/request/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: action === 'APPROVE' })
      })
      if (!res.ok) throw new Error('Failed to update request')
      toast({ title: 'Success', description: `Request ${action.toLowerCase()}d` })
      fetchRequests()
    } catch (e) {
      console.error(e)
      toast({ title: 'Error', description: 'Failed to update request', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Requests</h1>
        <p className="text-muted-foreground">Approve out-of-location check-ins</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.employee.firstName} {r.employee.lastName}</span>
                      <Badge variant="outline">{r.employee.employeeCode}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {format(new Date(r.date), 'MMM dd, yyyy')} at {format(new Date(r.checkInTime), 'p')}
                      </div>
                      {r.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {r.location.latitude.toFixed(4)}, {r.location.longitude.toFixed(4)}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-700">Reason: {r.reason}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => act(r.id, 'APPROVE')} className="bg-green-600 hover:bg-green-700">
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button onClick={() => act(r.id, 'REJECT')} variant="destructive">
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
              {requests.length === 0 && (
                <div className="text-center text-gray-500 py-8">No pending requests</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { MapPin, Clock, User, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react'
import { toast } from 'sonner'

interface AttendanceRequest {
  id: string
  employeeId: string
  employee: {
    firstName: string
    lastName: string
    employeeCode: string
  }
  date: string
  checkInTime: string
  location: {
    latitude: number
    longitude: number
    accuracy?: number
    validation?: {
      isValid: boolean
      nearestLocation?: {
        name: string
        distance: number
      }
      validLocations: Array<{
        name: string
        distance: number
        isWithinRadius: boolean
      }>
    }
  }
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvedBy?: string
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  createdAt: string
}

export function AttendanceRequestManager() {
  const [requests, setRequests] = useState<AttendanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<AttendanceRequest | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [comments, setComments] = useState('')

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/attendance/request')
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
      } else {
        toast.error('Failed to fetch attendance requests')
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
      toast.error('Failed to fetch attendance requests')
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (requestId: string, approved: boolean) => {
    setActionLoading(requestId)
    try {
      const response = await fetch(`/api/attendance/request/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approved,
          comments
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || `Request ${approved ? 'approved' : 'rejected'} successfully`)
        setIsDialogOpen(false)
        setComments('')
        setSelectedRequest(null)
        await fetchRequests()
      } else {
        toast.error(data.error || `Failed to ${approved ? 'approve' : 'reject'} request`)
      }
    } catch (error) {
      toast.error(`Failed to ${approved ? 'approve' : 'reject'} request`)
    } finally {
      setActionLoading(null)
    }
  }

  const openApprovalDialog = (request: AttendanceRequest) => {
    setSelectedRequest(request)
    setComments('')
    setIsDialogOpen(true)
  }

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDistance = (distance: number) => {
    if (distance < 1000) {
      return `${Math.round(distance)}m`
    }
    return `${(distance / 1000).toFixed(1)}km`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'PENDING')
  const processedRequests = requests.filter(r => r.status !== 'PENDING')

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading attendance requests...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Pending Approval ({pendingRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                No pending attendance requests requiring approval.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {request.employee.firstName} {request.employee.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {request.employee.employeeCode}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {new Date(request.date).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(request.checkInTime).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-mono">
                            {request.location.latitude.toFixed(6)}, {request.location.longitude.toFixed(6)}
                          </div>
                          {request.location.validation?.nearestLocation && (
                            <div className="text-xs text-muted-foreground">
                              Nearest: {request.location.validation.nearestLocation.name} 
                              ({formatDistance(request.location.validation.nearestLocation.distance)} away)
                            </div>
                          )}
                          {request.location.accuracy && (
                            <Badge variant="outline" className="text-xs">
                              ±{Math.round(request.location.accuracy)}m accuracy
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={request.reason}>
                          {request.reason}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openApprovalDialog(request)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Processed Requests ({processedRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {processedRequests.length === 0 ? (
            <Alert>
              <AlertDescription>
                No processed attendance requests found.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedRequests.slice(0, 10).map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {request.employee.firstName} {request.employee.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {request.employee.employeeCode}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {new Date(request.date).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(request.checkInTime).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {request.approvedAt && formatDateTime(request.approvedAt)}
                          {request.rejectedAt && formatDateTime(request.rejectedAt)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Attendance Request</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Employee</Label>
                  <div className="font-medium">
                    {selectedRequest.employee.firstName} {selectedRequest.employee.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedRequest.employee.employeeCode}
                  </div>
                </div>
                <div>
                  <Label>Date & Time</Label>
                  <div className="font-medium">
                    {new Date(selectedRequest.date).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Check-in: {new Date(selectedRequest.checkInTime).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Location Details */}
              <div>
                <Label>Location Details</Label>
                <div className="mt-2 p-4 border rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Coordinates</div>
                      <div className="font-mono text-sm">
                        {selectedRequest.location.latitude.toFixed(6)}, {selectedRequest.location.longitude.toFixed(6)}
                      </div>
                    </div>
                    {selectedRequest.location.accuracy && (
                      <div>
                        <div className="text-sm text-muted-foreground">GPS Accuracy</div>
                        <Badge variant="outline">
                          ±{Math.round(selectedRequest.location.accuracy)}m
                        </Badge>
                      </div>
                    )}
                  </div>

                  {selectedRequest.location.validation && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Assigned Locations</div>
                      <div className="space-y-2">
                        {selectedRequest.location.validation.validLocations.map((loc, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              {loc.isWithinRadius ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <MapPin className="h-4 w-4 text-gray-400" />
                              )}
                              <span className={loc.isWithinRadius ? 'text-green-700 font-medium' : 'text-muted-foreground'}>
                                {loc.name}
                              </span>
                            </div>
                            <Badge variant={loc.isWithinRadius ? 'default' : 'outline'}>
                              {formatDistance(loc.distance)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div>
                <Label>Reason for Request</Label>
                <div className="mt-2 p-3 border rounded-lg bg-muted/50">
                  {selectedRequest.reason}
                </div>
              </div>

              {/* Comments */}
              <div>
                <Label htmlFor="comments">Comments (Optional)</Label>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Add any comments about this approval/rejection..."
                  className="mt-2"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => handleApproval(selectedRequest.id, true)}
                  disabled={actionLoading === selectedRequest.id}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {actionLoading === selectedRequest.id ? 'Approving...' : 'Approve'}
                </Button>
                <Button
                  onClick={() => handleApproval(selectedRequest.id, false)}
                  disabled={actionLoading === selectedRequest.id}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {actionLoading === selectedRequest.id ? 'Rejecting...' : 'Reject'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
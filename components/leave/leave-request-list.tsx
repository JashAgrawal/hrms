'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Plus, Eye, Edit, X, Check, Clock, Calendar, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { LeaveRequestForm } from './leave-request-form'
import { useToast } from '@/hooks/use-toast'

const getStatusColor = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-800 hover:bg-green-200'
    case 'REJECTED':
      return 'bg-red-100 text-red-800 hover:bg-red-200'
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
  }
}

interface LeaveRequest {
  id: string
  employeeId: string
  policyId: string
  startDate: string
  endDate: string
  days: number
  reason: string
  emergencyContact?: any
  handoverNotes?: string
  attachments?: string[]
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  appliedAt: string
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectionReason?: string
  cancelledAt?: string
  cancellationReason?: string
  isHalfDay: boolean
  halfDayType?: 'FIRST_HALF' | 'SECOND_HALF'
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
  }
  policy: {
    id: string
    name: string
    code: string
    type: string
    requiresApproval: boolean
    approvalLevels: number
  }
  approvals: Array<{
    id: string
    approverId: string
    approverName?: string
    level: number
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    approvedAt?: string
    rejectedAt?: string
    comments?: string
  }>
}

interface LeaveRequestListProps {
  employeeId?: string
  showEmployeeColumn?: boolean
}

export function LeaveRequestList({ employeeId, showEmployeeColumn = true }: LeaveRequestListProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [cancellationReason, setCancellationReason] = useState('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [requestToCancel, setRequestToCancel] = useState<LeaveRequest | null>(null)
  const { toast } = useToast()

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (employeeId) params.append('employeeId', employeeId)
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/leave/requests?${params}`)
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
      } else {
        throw new Error('Failed to fetch leave requests')
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch leave requests',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [employeeId, statusFilter])

  const handleCancel = async (requestId: string, reason: string) => {
    try {
      const response = await fetch(`/api/leave/requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cancellationReason: reason }),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Leave request cancelled successfully',
        })
        fetchRequests()
        setShowCancelDialog(false)
        setRequestToCancel(null)
        setCancellationReason('')
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel request')
      }
    } catch (error) {
      console.error('Error cancelling request:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel request',
        variant: 'destructive',
      })
    }
  }

  const handleApproval = async (requestId: string, action: 'APPROVE' | 'REJECT', comments?: string) => {
    try {
      const response = await fetch(`/api/leave/requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, comments }),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: 'Success',
          description: result.message,
        })
        fetchRequests()
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
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const canCancel = (request: LeaveRequest) => {
    return ['PENDING', 'APPROVED'].includes(request.status) && 
           new Date(request.startDate) > new Date()
  }

  const canApprove = (request: LeaveRequest) => {
    return request.status === 'PENDING' && request.policy.requiresApproval
  }

  const columns = [
    ...(showEmployeeColumn ? [{
      key: 'employee',
      accessorKey: 'employee',
      header: 'Employee',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.employee.firstName} {row.original.employee.lastName}
          </span>
          <span className="text-sm text-muted-foreground">
            {row.original.employee.employeeCode}
          </span>
        </div>
      ),
    }] : []),
    {
      key: 'policy',
      accessorKey: 'policy',
      header: 'Leave Type',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.policy.name}</span>
          <Badge variant="outline" className="w-fit">
            {row.original.policy.code}
          </Badge>
        </div>
      ),
    },
    {
      key: 'dates',
      accessorKey: 'dates',
      header: 'Dates',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {format(new Date(row.original.startDate), 'MMM dd, yyyy')}
            {row.original.startDate !== row.original.endDate && (
              <> - {format(new Date(row.original.endDate), 'MMM dd, yyyy')}</>
            )}
          </span>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{row.original.days} day{row.original.days !== 1 ? 's' : ''}</span>
            {row.original.isHalfDay && (
              <Badge variant="secondary" className="text-xs">
                {row.original.halfDayType === 'FIRST_HALF' ? 'First Half' : 'Second Half'}
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }: any) => (
        <div className="max-w-xs">
          <p className="text-sm truncate" title={row.original.reason}>
            {row.original.reason}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => (
        <div className="flex flex-col gap-1">
          <Badge className={getStatusColor(row.original.status)}>
            {row.original.status}
          </Badge>
          {row.original.policy.requiresApproval && row.original.status === 'PENDING' && (
            <div className="text-xs text-muted-foreground">
              {row.original.approvals.filter((a: any) => a.status === 'APPROVED').length}/
              {row.original.policy.approvalLevels} approved
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'appliedAt',
      accessorKey: 'appliedAt',
      header: 'Applied',
      cell: ({ row }: any) => (
        <div className="text-sm">
          {format(new Date(row.original.appliedAt), 'MMM dd, yyyy')}
        </div>
      ),
    },
    {
      key: 'actions',
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedRequest(row.original)
              setShowDetails(true)
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          
          {canApprove(row.original) && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleApproval(row.original.id, 'APPROVE')}
              >
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleApproval(row.original.id, 'REJECT')}
              >
                <X className="h-4 w-4 text-red-600" />
              </Button>
            </>
          )}
          
          {canCancel(row.original) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRequestToCancel(row.original)
                setShowCancelDialog(true)
              }}
            >
              <X className="h-4 w-4 text-orange-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const statusCounts = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'PENDING').length,
    approved: requests.filter(r => r.status === 'APPROVED').length,
    rejected: requests.filter(r => r.status === 'REJECTED').length,
    cancelled: requests.filter(r => r.status === 'CANCELLED').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leave Requests</h2>
          <p className="text-muted-foreground">
            Manage and track leave requests
          </p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit Leave Request</DialogTitle>
            </DialogHeader>
            <LeaveRequestForm
              onSuccess={() => {
                setShowForm(false)
                fetchRequests()
              }}
              onCancel={() => setShowForm(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statusCounts.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <X className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statusCounts.rejected}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{statusCounts.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>
                View and manage leave requests
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<LeaveRequest>
            columns={columns}
            data={requests}
            loading={loading}
            searchKey={showEmployeeColumn ? "employee.firstName" : "reason"}
            searchPlaceholder={showEmployeeColumn ? "Search employees..." : "Search requests..."}
          />
        </CardContent>
      </Card>

      {/* Request Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <LeaveRequestDetails 
              request={selectedRequest} 
              onApproval={(action, comments) => {
                handleApproval(selectedRequest.id, action, comments)
                setShowDetails(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Request Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this leave request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancellation-reason">Cancellation Reason</Label>
            <Textarea
              id="cancellation-reason"
              placeholder="Please provide a reason for cancellation"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowCancelDialog(false)
              setRequestToCancel(null)
              setCancellationReason('')
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (requestToCancel) {
                  handleCancel(requestToCancel.id, cancellationReason)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface LeaveRequestDetailsProps {
  request: LeaveRequest
  onApproval?: (action: 'APPROVE' | 'REJECT', comments?: string) => void
}

function LeaveRequestDetails({ request, onApproval }: LeaveRequestDetailsProps) {
  const [comments, setComments] = useState('')

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="text-sm font-medium">Employee</Label>
          <p className="text-sm">
            {request.employee.firstName} {request.employee.lastName} ({request.employee.employeeCode})
          </p>
        </div>
        
        <div>
          <Label className="text-sm font-medium">Leave Type</Label>
          <p className="text-sm">{request.policy.name}</p>
        </div>
        
        <div>
          <Label className="text-sm font-medium">Duration</Label>
          <p className="text-sm">
            {format(new Date(request.startDate), 'MMM dd, yyyy')}
            {request.startDate !== request.endDate && (
              <> - {format(new Date(request.endDate), 'MMM dd, yyyy')}</>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {request.days} day{request.days !== 1 ? 's' : ''}
            {request.isHalfDay && ` (${request.halfDayType === 'FIRST_HALF' ? 'First Half' : 'Second Half'})`}
          </p>
        </div>
        
        <div>
          <Label className="text-sm font-medium">Status</Label>
          <Badge className={getStatusColor(request.status)}>
            {request.status}
          </Badge>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Reason</Label>
        <p className="text-sm mt-1">{request.reason}</p>
      </div>

      {request.handoverNotes && (
        <div>
          <Label className="text-sm font-medium">Handover Notes</Label>
          <p className="text-sm mt-1">{request.handoverNotes}</p>
        </div>
      )}

      {request.emergencyContact && (
        <div>
          <Label className="text-sm font-medium">Emergency Contact</Label>
          <div className="text-sm mt-1 space-y-1">
            {request.emergencyContact.name && <p>Name: {request.emergencyContact.name}</p>}
            {request.emergencyContact.phone && <p>Phone: {request.emergencyContact.phone}</p>}
            {request.emergencyContact.relationship && <p>Relationship: {request.emergencyContact.relationship}</p>}
          </div>
        </div>
      )}

      {request.policy.requiresApproval && (
        <div>
          <Label className="text-sm font-medium">Approval Status</Label>
          <div className="mt-2 space-y-2">
            {request.approvals.map((approval, index) => (
              <div key={approval.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Level {approval.level}</span>
                  {approval.comments && (
                    <p className="text-xs text-muted-foreground">{approval.comments}</p>
                  )}
                  {/* Approver details */}
                  <div className="text-xs text-muted-foreground mt-1">
                    {approval.status === 'PENDING' ? (
                      <span>Awaiting approval</span>
                    ) : (
                      <span>
                        {approval.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                        {approval.approverName ? ` by ${approval.approverName}` : ''}
                        {approval.approvedAt || approval.rejectedAt ?
                          ` on ${format(new Date(approval.approvedAt || approval.rejectedAt as string), 'MMM dd, yyyy p')}`
                          : ''}
                      </span>
                    )}
                  </div>
                </div>
                <Badge className={getStatusColor(approval.status)}>
                  {approval.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {onApproval && request.status === 'PENDING' && (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <Label htmlFor="approval-comments">Comments (Optional)</Label>
            <Textarea
              id="approval-comments"
              placeholder="Add comments for your decision"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mt-2"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => onApproval('APPROVE', comments)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              onClick={() => onApproval('REJECT', comments)}
              variant="destructive"
            >
              <X className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  MessageSquare,
  Calendar,
  FileText
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface LeaveApproval {
  id: string
  approverId: string
  approverName?: string
  level: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvedAt?: string
  rejectedAt?: string
  comments?: string
  createdAt: string
  updatedAt: string
}

interface LeaveRequest {
  id: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  appliedAt: string
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectionReason?: string
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
  approvals: LeaveApproval[]
}

interface LeaveApprovalHistoryProps {
  leaveRequestId: string
  canApprove?: boolean
  onApprovalUpdate?: () => void
}

export function LeaveApprovalHistory({ 
  leaveRequestId, 
  canApprove = false,
  onApprovalUpdate 
}: LeaveApprovalHistoryProps) {
  const [leaveRequest, setLeaveRequest] = useState<LeaveRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [comments, setComments] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    fetchLeaveRequest()
  }, [leaveRequestId])

  const fetchLeaveRequest = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leave/requests/${leaveRequestId}`)
      
      if (response.ok) {
        const data = await response.json()
        setLeaveRequest(data)
      } else {
        throw new Error('Failed to fetch leave request')
      }
    } catch (error) {
      console.error('Error fetching leave request:', error)
      toast({
        title: "Error",
        description: "Failed to fetch leave request details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async () => {
    try {
      setApproving(true)
      
      const response = await fetch(`/api/leave/requests/${leaveRequestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: approvalAction,
          comments: comments.trim() || undefined,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Success",
          description: result.message,
        })
        setShowApprovalDialog(false)
        setComments('')
        fetchLeaveRequest()
        onApprovalUpdate?.()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process approval')
      }
    } catch (error) {
      console.error('Error processing approval:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process approval",
        variant: "destructive",
      })
    } finally {
      setApproving(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'REJECTED':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!leaveRequest) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600">Leave request not found</p>
        </CardContent>
      </Card>
    )
  }

  const pendingApproval = leaveRequest.approvals.find(
    approval => approval.status === 'PENDING'
  )

  return (
    <div className="space-y-6">
      {/* Leave Request Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave Request Details
            </CardTitle>
            <Badge className={getStatusColor(leaveRequest.status)}>
              {leaveRequest.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-600">Employee</p>
              <p className="font-medium">
                {leaveRequest.employee.firstName} {leaveRequest.employee.lastName}
                <span className="text-sm text-gray-500 ml-2">
                  ({leaveRequest.employee.employeeCode})
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Leave Type</p>
              <p className="font-medium">{leaveRequest.policy.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Duration</p>
              <p className="font-medium">
                {format(new Date(leaveRequest.startDate), 'MMM dd, yyyy')} - {' '}
                {format(new Date(leaveRequest.endDate), 'MMM dd, yyyy')}
                <span className="text-sm text-gray-500 ml-2">
                  ({leaveRequest.days} day{leaveRequest.days > 1 ? 's' : ''})
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Applied On</p>
              <p className="font-medium">
                {format(new Date(leaveRequest.appliedAt), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-gray-600 mb-2">Reason</p>
            <p className="text-sm bg-gray-50 p-3 rounded-lg">{leaveRequest.reason}</p>
          </div>
        </CardContent>
      </Card>

      {/* Approval History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Approval History
            </CardTitle>
            {canApprove && pendingApproval && leaveRequest.status === 'PENDING' && (
              <div className="flex gap-2">
                <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setApprovalAction('REJECT')}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </DialogTrigger>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      onClick={() => setApprovalAction('APPROVE')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </DialogTrigger>
                  
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {approvalAction === 'APPROVE' ? 'Approve' : 'Reject'} Leave Request
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm">
                          <strong>Employee:</strong> {leaveRequest.employee.firstName} {leaveRequest.employee.lastName}
                        </p>
                        <p className="text-sm">
                          <strong>Duration:</strong> {format(new Date(leaveRequest.startDate), 'MMM dd')} - {format(new Date(leaveRequest.endDate), 'MMM dd, yyyy')} ({leaveRequest.days} days)
                        </p>
                        <p className="text-sm">
                          <strong>Type:</strong> {leaveRequest.policy.name}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="comments">
                          Comments {approvalAction === 'REJECT' && <span className="text-red-500">*</span>}
                        </Label>
                        <Textarea
                          id="comments"
                          placeholder={
                            approvalAction === 'APPROVE' 
                              ? "Add any comments (optional)" 
                              : "Please provide reason for rejection"
                          }
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowApprovalDialog(false)
                            setComments('')
                          }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleApproval}
                          disabled={approving || (approvalAction === 'REJECT' && !comments.trim())}
                          className={`flex-1 ${
                            approvalAction === 'APPROVE' 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {approving ? 'Processing...' : `${approvalAction === 'APPROVE' ? 'Approve' : 'Reject'} Request`}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {leaveRequest.approvals.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No approval required for this leave type</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaveRequest.approvals.map((approval, index) => (
                <div
                  key={approval.id}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(approval.status)}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          Level {approval.level} Approval
                        </p>
                        <p className="text-sm text-gray-600">
                          {approval.approverName || `Approver ID: ${approval.approverId}`}
                        </p>
                      </div>
                      <Badge className={getStatusColor(approval.status)}>
                        {approval.status}
                      </Badge>
                    </div>
                    
                    {approval.status !== 'PENDING' && (
                      <div className="text-sm text-gray-600">
                        {approval.status === 'APPROVED' && approval.approvedAt && (
                          <p>Approved on {format(new Date(approval.approvedAt), 'MMM dd, yyyy HH:mm')}</p>
                        )}
                        {approval.status === 'REJECTED' && approval.rejectedAt && (
                          <p>Rejected on {format(new Date(approval.rejectedAt), 'MMM dd, yyyy HH:mm')}</p>
                        )}
                      </div>
                    )}
                    
                    {approval.comments && (
                      <div className="flex items-start gap-2 mt-2">
                        <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5" />
                        <p className="text-sm bg-gray-50 p-2 rounded flex-1">
                          {approval.comments}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
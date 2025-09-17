'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Calendar,
  MapPin,
  Receipt,
  User,
  Building,
  CreditCard,
  FileText,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Car,
  Calculator
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ExpenseClaim {
  id: string
  title: string
  description?: string
  amount: number
  expenseDate: Date
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'CANCELLED'
  merchantName?: string
  merchantAddress?: string
  billNumber?: string
  taxAmount?: number
  taxRate?: number
  distanceTraveled?: number
  vehicleNumber?: string
  location?: {
    latitude: number
    longitude: number
    address?: string
  }
  policyViolations?: Array<{
    rule: string
    message: string
  }>
  category: {
    id: string
    name: string
    code: string
    maxAmount?: number
    requiresReceipt: boolean
    requiresApproval: boolean
  }
  employee?: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    email: string
  }
  attachments: Array<{
    id: string
    fileName: string
    fileType: string
    fileSize: number
    fileUrl?: string
  }>
  approvals: Array<{
    id: string
    level: number
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    approverName: string
    approverEmail?: string
    approvedAt?: Date
    comments?: string
  }>
  travelRequest?: {
    id: string
    title: string
    destination: string
  }
  createdAt: Date
  updatedAt: Date
}

interface ExpenseClaimDetailsProps {
  claim: ExpenseClaim
  onClose: () => void
  onEdit?: () => void
  onApprove?: (comments?: string) => void
  onReject?: (comments: string) => void
  canApprove?: boolean
  canEdit?: boolean
}

const statusConfig = {
  PENDING: {
    label: 'Pending Approval',
    variant: 'secondary' as const,
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50'
  },
  APPROVED: {
    label: 'Approved',
    variant: 'default' as const,
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  REJECTED: {
    label: 'Rejected',
    variant: 'destructive' as const,
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  REIMBURSED: {
    label: 'Reimbursed',
    variant: 'default' as const,
    icon: DollarSign,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  CANCELLED: {
    label: 'Cancelled',
    variant: 'outline' as const,
    icon: AlertTriangle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  }
}

export function ExpenseClaimDetails({ 
  claim, 
  onClose, 
  onEdit, 
  onApprove, 
  onReject, 
  canApprove = false, 
  canEdit = false 
}: ExpenseClaimDetailsProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null)
  const [approvalComments, setApprovalComments] = useState('')
  const [showApprovalDialog, setShowApprovalDialog] = useState<'approve' | 'reject' | null>(null)

  const statusInfo = statusConfig[claim.status]
  const StatusIcon = statusInfo.icon

  // Calculate total amount including tax
  const totalAmount = claim.amount + (claim.taxAmount || 0)

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Handle approval actions
  const handleApproval = (action: 'approve' | 'reject') => {
    if (action === 'approve' && onApprove) {
      onApprove(approvalComments || undefined)
    } else if (action === 'reject' && onReject) {
      onReject(approvalComments)
    }
    setShowApprovalDialog(null)
    setApprovalComments('')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{claim.title}</h1>
          <div className="flex items-center space-x-4">
            <div className={cn("flex items-center space-x-2 px-3 py-1 rounded-full", statusInfo.bgColor)}>
              <StatusIcon className={cn("h-4 w-4", statusInfo.color)} />
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              Claim ID: {claim.id.slice(-8).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex space-x-2">
          {canEdit && claim.status === 'PENDING' && (
            <Button variant="outline" onClick={onEdit}>
              Edit Claim
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Policy Violations Alert */}
      {claim.policyViolations && claim.policyViolations.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Policy Violations Detected:</p>
              {claim.policyViolations.map((violation, index) => (
                <p key={index} className="text-sm">• {violation.message}</p>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Expense Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{claim.category.name}</Badge>
                    {claim.category.maxAmount && (
                      <span className="text-xs text-muted-foreground">
                        (Max: ₹{claim.category.maxAmount.toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Expense Date</label>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(claim.expenseDate), 'PPP')}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <div className="text-2xl font-bold">₹{claim.amount.toLocaleString()}</div>
                </div>

                {claim.taxAmount && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Tax Details</label>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Tax Rate:</span>
                        <span>{claim.taxRate}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax Amount:</span>
                        <span>₹{claim.taxAmount.toLocaleString()}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total Amount:</span>
                        <span>₹{totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {claim.description && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm">{claim.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Merchant Information */}
          {(claim.merchantName || claim.merchantAddress || claim.billNumber) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building className="h-5 w-5" />
                  <span>Merchant Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {claim.merchantName && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Merchant Name</label>
                      <p>{claim.merchantName}</p>
                    </div>
                  )}

                  {claim.billNumber && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Bill Number</label>
                      <p>{claim.billNumber}</p>
                    </div>
                  )}
                </div>

                {claim.merchantAddress && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Merchant Address</label>
                    <p className="text-sm">{claim.merchantAddress}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Travel Information */}
          {(claim.distanceTraveled || claim.vehicleNumber) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Car className="h-5 w-5" />
                  <span>Travel Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {claim.distanceTraveled && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Distance Traveled</label>
                      <p>{claim.distanceTraveled} km</p>
                    </div>
                  )}

                  {claim.vehicleNumber && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Vehicle Number</label>
                      <p>{claim.vehicleNumber}</p>
                    </div>
                  )}
                </div>

                {claim.travelRequest && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Related Travel Request</label>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{claim.travelRequest.title}</Badge>
                      <span className="text-sm text-muted-foreground">
                        to {claim.travelRequest.destination}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Location Information */}
          {claim.location && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Location Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">{claim.location.address}</p>
                  <p className="text-xs text-muted-foreground">
                    Coordinates: {claim.location.latitude.toFixed(6)}, {claim.location.longitude.toFixed(6)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Receipt className="h-5 w-5" />
                <span>Attachments ({claim.attachments.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {claim.attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments uploaded</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {claim.attachments.map((attachment) => (
                    <div key={attachment.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.fileSize)} • {attachment.fileType}
                          </p>
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAttachment(attachment.fileUrl || null)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(attachment.fileUrl, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Employee Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Employee</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{claim.employee?.firstName} {claim.employee?.lastName}</p>
                <p className="text-sm text-muted-foreground">{claim.employee?.employeeCode}</p>
                <p className="text-sm text-muted-foreground">{claim.employee?.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Approval Workflow */}
          <Card>
            <CardHeader>
              <CardTitle>Approval Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              {claim.approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approval required</p>
              ) : (
                <div className="space-y-3">
                  {claim.approvals.map((approval, index) => (
                    <div key={approval.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {approval.status === 'APPROVED' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : approval.status === 'REJECTED' ? (
                          <XCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{approval.approverName}</p>
                          <Badge 
                            variant={
                              approval.status === 'APPROVED' ? 'default' :
                              approval.status === 'REJECTED' ? 'destructive' : 'secondary'
                            }
                            className="text-xs"
                          >
                            Level {approval.level}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{approval.approverEmail}</p>
                        {approval.approvedAt && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(approval.approvedAt), 'PPp')}
                          </p>
                        )}
                        {approval.comments && (
                          <p className="text-xs mt-1 p-2 bg-gray-50 rounded">
                            {approval.comments}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval Actions */}
          {canApprove && claim.status === 'PENDING' && (
            <Card>
              <CardHeader>
                <CardTitle>Approval Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => setShowApprovalDialog('approve')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={() => setShowApprovalDialog('reject')}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(claim.createdAt), 'PPp')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(claim.updatedAt), 'PPp')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approval Dialog */}
      {showApprovalDialog && (
        <Dialog open={true} onOpenChange={() => setShowApprovalDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {showApprovalDialog === 'approve' ? 'Approve' : 'Reject'} Expense Claim
              </DialogTitle>
              <DialogDescription>
                {showApprovalDialog === 'approve' 
                  ? 'Add optional comments for this approval.'
                  : 'Please provide a reason for rejecting this expense claim.'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  Comments {showApprovalDialog === 'reject' && '*'}
                </label>
                <textarea
                  className="w-full mt-1 p-2 border rounded-md"
                  rows={3}
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder={
                    showApprovalDialog === 'approve' 
                      ? 'Optional comments...'
                      : 'Reason for rejection...'
                  }
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowApprovalDialog(null)}>
                  Cancel
                </Button>
                <Button
                  variant={showApprovalDialog === 'approve' ? 'default' : 'destructive'}
                  onClick={() => handleApproval(showApprovalDialog)}
                  disabled={showApprovalDialog === 'reject' && !approvalComments.trim()}
                >
                  {showApprovalDialog === 'approve' ? 'Approve' : 'Reject'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Attachment Viewer */}
      {selectedAttachment && (
        <Dialog open={true} onOpenChange={() => setSelectedAttachment(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Attachment Viewer</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <Image
                src={selectedAttachment}
                alt="Attachment"
                width={800}
                height={600}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
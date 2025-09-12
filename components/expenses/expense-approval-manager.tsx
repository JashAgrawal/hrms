'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Filter,
  Search,
  Calendar,
  DollarSign,
  User,
  AlertTriangle,
  FileText,
  MapPin,
  Receipt,
  TrendingUp,
  Users
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
  billNumber?: string
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
  employee: {
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
    approvedAt?: Date
    comments?: string
  }>
  createdAt: Date
  updatedAt: Date
}

interface ApprovalStats {
  totalPending: number
  totalApproved: number
  totalRejected: number
  totalAmount: number
  avgProcessingTime: number
}

interface ExpenseApprovalManagerProps {
  onViewDetails: (claim: ExpenseClaim) => void
}

export function ExpenseApprovalManager({ onViewDetails }: ExpenseApprovalManagerProps) {
  const [claims, setClaims] = useState<ExpenseClaim[]>([])
  const [stats, setStats] = useState<ApprovalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [amountFilter, setAmountFilter] = useState<{ min: string; max: string }>({ min: '', max: '' })
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null)
  const [approvalComments, setApprovalComments] = useState('')
  const [processing, setProcessing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Fetch pending approvals
  const fetchClaims = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        pendingApproval: 'true',
      })

      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (categoryFilter !== 'all') params.append('categoryId', categoryFilter)
      if (amountFilter.min) params.append('minAmount', amountFilter.min)
      if (amountFilter.max) params.append('maxAmount', amountFilter.max)

      const response = await fetch(`/api/expenses?${params}`)
      if (response.ok) {
        const data = await response.json()
        setClaims(data.data || [])
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('Error fetching expense claims:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch approval statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/expenses/approval-stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching approval stats:', error)
    }
  }

  useEffect(() => {
    fetchClaims()
    fetchStats()
  }, [currentPage, statusFilter, categoryFilter, amountFilter])

  // Filter claims based on search term
  const filteredClaims = claims.filter(claim =>
    claim.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.employee.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.employee.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.merchantName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle approval action
  const handleApproval = async (claimId: string, action: 'approve' | 'reject', comments?: string) => {
    setProcessing(true)
    try {
      const response = await fetch(`/api/expenses/${claimId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action.toUpperCase(),
          comments,
        }),
      })

      if (response.ok) {
        await fetchClaims()
        await fetchStats()
        setSelectedClaim(null)
        setApprovalAction(null)
        setApprovalComments('')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to process approval')
      }
    } catch (error) {
      console.error('Error processing approval:', error)
      alert('Error processing approval')
    } finally {
      setProcessing(false)
    }
  }

  // Get priority level based on amount and policy violations
  const getPriorityLevel = (claim: ExpenseClaim) => {
    if (claim.policyViolations && claim.policyViolations.length > 0) {
      return { level: 'high', label: 'High Priority', color: 'text-red-600' }
    }
    if (claim.amount > 10000) {
      return { level: 'medium', label: 'Medium Priority', color: 'text-yellow-600' }
    }
    return { level: 'low', label: 'Normal', color: 'text-green-600' }
  }

  // Get days pending
  const getDaysPending = (createdAt: Date) => {
    const days = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve expense claims from your team members
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Pending</p>
                  <p className="text-2xl font-bold">{stats.totalPending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Approved</p>
                  <p className="text-2xl font-bold">{stats.totalApproved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Rejected</p>
                  <p className="text-2xl font-bold">{stats.totalRejected}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Amount</p>
                  <p className="text-2xl font-bold">₹{stats.totalAmount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Avg. Processing</p>
                  <p className="text-2xl font-bold">{stats.avgProcessingTime}d</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search claims..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="all">All Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="TRAVEL">Travel</SelectItem>
                  <SelectItem value="MEALS">Meals</SelectItem>
                  <SelectItem value="ACCOMMODATION">Accommodation</SelectItem>
                  <SelectItem value="PETROL">Petrol</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Min Amount</label>
              <Input
                type="number"
                placeholder="0"
                value={amountFilter.min}
                onChange={(e) => setAmountFilter(prev => ({ ...prev, min: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Amount</label>
              <Input
                type="number"
                placeholder="No limit"
                value={amountFilter.max}
                onChange={(e) => setAmountFilter(prev => ({ ...prev, max: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Claims</CardTitle>
          <CardDescription>
            {filteredClaims.length} claim(s) requiring your approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No expense claims found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Days Pending</TableHead>
                    <TableHead>Attachments</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map((claim) => {
                    const priority = getPriorityLevel(claim)
                    const daysPending = getDaysPending(claim.createdAt)

                    return (
                      <TableRow key={claim.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">
                              {claim.employee.firstName} {claim.employee.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {claim.employee.employeeCode}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{claim.title}</p>
                            {claim.merchantName && (
                              <p className="text-sm text-muted-foreground">
                                {claim.merchantName}
                              </p>
                            )}
                            {claim.policyViolations && claim.policyViolations.length > 0 && (
                              <div className="flex items-center text-xs text-red-600">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Policy violations
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{claim.category.name}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            ₹{claim.amount.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm">
                            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                            {format(new Date(claim.expenseDate), 'MMM dd')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", priority.color)}
                          >
                            {priority.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={daysPending > 3 ? 'destructive' : daysPending > 1 ? 'secondary' : 'outline'}
                          >
                            {daysPending}d
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{claim.attachments.length}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onViewDetails(claim)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {claim.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedClaim(claim)
                                    setApprovalAction('approve')
                                  }}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedClaim(claim)
                                    setApprovalAction('reject')
                                  }}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      {selectedClaim && approvalAction && (
        <Dialog open={true} onOpenChange={() => {
          setSelectedClaim(null)
          setApprovalAction(null)
          setApprovalComments('')
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {approvalAction === 'approve' ? 'Approve' : 'Reject'} Expense Claim
              </DialogTitle>
              <DialogDescription>
                {selectedClaim.title} by {selectedClaim.employee.firstName} {selectedClaim.employee.lastName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Claim Summary */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Amount:</span>
                  <span>₹{selectedClaim.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Category:</span>
                  <span>{selectedClaim.category.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Date:</span>
                  <span>{format(new Date(selectedClaim.expenseDate), 'PPP')}</span>
                </div>
                {selectedClaim.merchantName && (
                  <div className="flex justify-between">
                    <span className="font-medium">Merchant:</span>
                    <span>{selectedClaim.merchantName}</span>
                  </div>
                )}
              </div>

              {/* Policy Violations */}
              {selectedClaim.policyViolations && selectedClaim.policyViolations.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Policy Violations:</p>
                      {selectedClaim.policyViolations.map((violation, index) => (
                        <p key={index} className="text-sm">• {violation.message}</p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Comments */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Comments {approvalAction === 'reject' && <span className="text-red-500">*</span>}
                </label>
                <Textarea
                  placeholder={
                    approvalAction === 'approve' 
                      ? 'Optional comments for approval...'
                      : 'Please provide a reason for rejection...'
                  }
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedClaim(null)
                    setApprovalAction(null)
                    setApprovalComments('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant={approvalAction === 'approve' ? 'default' : 'destructive'}
                  onClick={() => handleApproval(selectedClaim.id, approvalAction, approvalComments)}
                  disabled={processing || (approvalAction === 'reject' && !approvalComments.trim())}
                >
                  {processing ? 'Processing...' : (approvalAction === 'approve' ? 'Approve' : 'Reject')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
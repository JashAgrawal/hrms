'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  CreditCard,
  FileText,
  Users,
  Calendar,
  Filter,
  Download,
  Send,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'

interface ReimbursementClaim {
  id: string
  title: string
  amount: number
  expenseDate: Date
  approvedAt: Date
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    email: string
  }
  category: {
    id: string
    name: string
    code: string
  }
  reimbursementBatchId?: string
  reimbursedAt?: Date
}

interface ReimbursementBatch {
  id: string
  batchId: string
  totalAmount: number
  totalClaims: number
  paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE'
  referenceNumber?: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  processedAt: Date
  completedAt?: Date
  notes?: string
}

interface ReimbursementStats {
  pendingAmount: number
  pendingClaims: number
  processingAmount: number
  processingClaims: number
  completedAmount: number
  completedClaims: number
  avgProcessingTime: number
}

export function ReimbursementDashboard() {
  const { data: session } = useSession()
  const [pendingClaims, setPendingClaims] = useState<ReimbursementClaim[]>([])
  const [reimbursementBatches, setReimbursementBatches] = useState<ReimbursementBatch[]>([])
  const [stats, setStats] = useState<ReimbursementStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedClaims, setSelectedClaims] = useState<string[]>([])
  const [showProcessDialog, setShowProcessDialog] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Process reimbursement form data
  const [processForm, setProcessForm] = useState({
    paymentMethod: 'BANK_TRANSFER' as const,
    referenceNumber: '',
    notes: ''
  })

  // Filters
  const [filters, setFilters] = useState({
    employeeId: '',
    categoryId: '',
    minAmount: '',
    maxAmount: ''
  })

  useEffect(() => {
    fetchPendingClaims()
    fetchReimbursementBatches()
    fetchStats()
  }, [filters])

  const fetchPendingClaims = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('status', 'APPROVED')
      
      if (filters.employeeId) params.append('employeeId', filters.employeeId)
      if (filters.categoryId) params.append('categoryId', filters.categoryId)

      const response = await fetch(`/api/expenses/reimbursement?${params}`)
      if (response.ok) {
        const data = await response.json()
        setPendingClaims(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching pending claims:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReimbursementBatches = async () => {
    try {
      const response = await fetch('/api/expenses/reimbursement/batches')
      if (response.ok) {
        const data = await response.json()
        setReimbursementBatches(data.batches || [])
      }
    } catch (error) {
      console.error('Error fetching reimbursement batches:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/expenses/reimbursement/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching reimbursement stats:', error)
    }
  }

  const handleSelectClaim = (claimId: string, selected: boolean) => {
    if (selected) {
      setSelectedClaims(prev => [...prev, claimId])
    } else {
      setSelectedClaims(prev => prev.filter(id => id !== claimId))
    }
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedClaims(pendingClaims.map(claim => claim.id))
    } else {
      setSelectedClaims([])
    }
  }

  const handleProcessReimbursement = async () => {
    if (selectedClaims.length === 0) {
      alert('Please select at least one claim to process')
      return
    }

    setProcessing(true)
    try {
      const response = await fetch('/api/expenses/reimbursement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expenseIds: selectedClaims,
          paymentMethod: processForm.paymentMethod,
          referenceNumber: processForm.referenceNumber,
          notes: processForm.notes
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Successfully processed ${result.processedClaims} reimbursements`)
        setShowProcessDialog(false)
        setSelectedClaims([])
        setProcessForm({
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: '',
          notes: ''
        })
        await fetchPendingClaims()
        await fetchReimbursementBatches()
        await fetchStats()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to process reimbursements')
      }
    } catch (error) {
      console.error('Error processing reimbursements:', error)
      alert('Error processing reimbursements')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>
      case 'PROCESSING':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Processing</Badge>
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'BANK_TRANSFER':
        return <CreditCard className="h-4 w-4" />
      case 'CASH':
        return <DollarSign className="h-4 w-4" />
      case 'CHEQUE':
        return <FileText className="h-4 w-4" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  const selectedClaimsTotal = pendingClaims
    .filter(claim => selectedClaims.includes(claim.id))
    .reduce((sum, claim) => sum + claim.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reimbursement Management</h1>
          <p className="text-muted-foreground">
            Process and track expense reimbursements
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setShowProcessDialog(true)}
            disabled={selectedClaims.length === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            Process Selected ({selectedClaims.length})
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Pending</p>
                  <p className="text-2xl font-bold">{stats.pendingClaims}</p>
                  <p className="text-xs text-muted-foreground">
                    ₹{stats.pendingAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Processing</p>
                  <p className="text-2xl font-bold">{stats.processingClaims}</p>
                  <p className="text-xs text-muted-foreground">
                    ₹{stats.processingAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Completed</p>
                  <p className="text-2xl font-bold">{stats.completedClaims}</p>
                  <p className="text-xs text-muted-foreground">
                    ₹{stats.completedAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Avg Processing</p>
                  <p className="text-2xl font-bold">{stats.avgProcessingTime}</p>
                  <p className="text-xs text-muted-foreground">days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Claims */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pending Reimbursements</CardTitle>
              <CardDescription>
                Approved expense claims ready for reimbursement processing
              </CardDescription>
            </div>
            {selectedClaims.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Selected: {selectedClaims.length} claims • ₹{selectedClaimsTotal.toLocaleString()}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedClaims.length === pendingClaims.length && pendingClaims.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Expense</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Approved Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedClaims.includes(claim.id)}
                        onCheckedChange={(checked) => handleSelectClaim(claim.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {claim.employee.firstName} {claim.employee.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {claim.employee.employeeCode}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{claim.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(claim.expenseDate), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{claim.category.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">₹{claim.amount.toLocaleString()}</div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(claim.approvedAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Batches */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reimbursement Batches</CardTitle>
          <CardDescription>
            Recently processed reimbursement batches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch ID</TableHead>
                <TableHead>Claims</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processed Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reimbursementBatches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell>
                    <div className="font-medium">{batch.batchId}</div>
                    {batch.referenceNumber && (
                      <div className="text-sm text-muted-foreground">
                        Ref: {batch.referenceNumber}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{batch.totalClaims}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">₹{batch.totalAmount.toLocaleString()}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getPaymentMethodIcon(batch.paymentMethod)}
                      <span>{batch.paymentMethod.replace('_', ' ')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(batch.status)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(batch.processedAt), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Process Reimbursement Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Reimbursements</DialogTitle>
            <DialogDescription>
              Process {selectedClaims.length} selected expense claims for reimbursement
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium">Summary</div>
              <div className="text-2xl font-bold">₹{selectedClaimsTotal.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">
                {selectedClaims.length} claims selected
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={processForm.paymentMethod}
                onValueChange={(value: any) => setProcessForm(prev => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference Number</Label>
              <Input
                id="referenceNumber"
                placeholder="Transaction/Reference number"
                value={processForm.referenceNumber}
                onChange={(e) => setProcessForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this reimbursement batch"
                value={processForm.notes}
                onChange={(e) => setProcessForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowProcessDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProcessReimbursement}
                disabled={processing}
                className="flex-1"
              >
                {processing ? 'Processing...' : 'Process Reimbursements'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
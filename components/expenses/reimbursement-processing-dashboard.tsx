'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  CreditCard, 
  Download, 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Users,
  DollarSign,
  FileText,
  Mail,
  Building2
} from 'lucide-react'

interface ReimbursementBatch {
  id: string
  batchId: string
  totalAmount: number
  totalClaims: number
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  paymentMethod: string
  referenceNumber?: string
  processedAt: string
  completedAt?: string
  failedAt?: string
  failureReason?: string
  expenseClaims: Array<{
    id: string
    title: string
    amount: number
    employee: {
      firstName: string
      lastName: string
      employeeCode: string
    }
  }>
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

export function ReimbursementProcessingDashboard() {
  const [batches, setBatches] = useState<ReimbursementBatch[]>([])
  const [stats, setStats] = useState<ReimbursementStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<ReimbursementBatch | null>(null)
  const [bankingProvider, setBankingProvider] = useState('ICICI')
  const [paymentMode, setPaymentMode] = useState('NEFT')
  const [processingBatch, setProcessingBatch] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch batches and stats in parallel
      const [batchesRes, statsRes] = await Promise.all([
        fetch('/api/expenses/reimbursement/batches'),
        fetch('/api/expenses/reimbursement/stats')
      ])

      if (batchesRes.ok) {
        const batchesData = await batchesRes.json()
        setBatches(batchesData.batches || [])
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }
    } catch (error) {
      console.error('Error fetching reimbursement data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchStatusUpdate = async (batchId: string, status: string, referenceNumber?: string, failureReason?: string) => {
    try {
      setProcessingBatch(batchId)
      
      const response = await fetch(`/api/expenses/reimbursement/batches?batchId=${batchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          referenceNumber,
          failureReason,
          completedAt: status === 'COMPLETED' ? new Date().toISOString() : undefined,
          sendNotifications: true
        })
      })

      if (response.ok) {
        await fetchData() // Refresh data
        setSelectedBatch(null)
      } else {
        const error = await response.json()
        alert(`Error updating batch: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating batch status:', error)
      alert('Error updating batch status')
    } finally {
      setProcessingBatch(null)
    }
  }

  const handleBankingIntegration = async (batchId: string) => {
    try {
      setProcessingBatch(batchId)
      
      const response = await fetch('/api/expenses/reimbursement/banking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          batchId,
          bankingProvider,
          paymentMode,
          generateFile: true,
          processPayment: false // Set to true for actual payment processing
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Download the banking file
        if (result.bankingFile) {
          const blob = new Blob([result.bankingFile.content], { 
            type: result.bankingFile.fileName.endsWith('.csv') ? 'text/csv' : 'application/json' 
          })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = result.bankingFile.fileName
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }

        alert(`Banking file generated successfully for ${result.totalPayments} payments`)
      } else {
        const error = await response.json()
        alert(`Error generating banking file: ${error.error}`)
      }
    } catch (error) {
      console.error('Error processing banking integration:', error)
      alert('Error processing banking integration')
    } finally {
      setProcessingBatch(null)
    }
  }

  const handleSendNotifications = async (batchId: string, type: string) => {
    try {
      const response = await fetch('/api/expenses/reimbursement/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'BATCH_STATUS',
          batchId,
          notificationType: type,
          includeFinanceTeam: true
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Notifications sent to ${result.result.totalEmployees} employees`)
      } else {
        const error = await response.json()
        alert(`Error sending notifications: ${error.error}`)
      }
    } catch (error) {
      console.error('Error sending notifications:', error)
      alert('Error sending notifications')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'PROCESSING':
        return <Clock className="h-4 w-4 text-blue-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reimbursements</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.pendingAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{stats.pendingClaims} claims</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.processingAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{stats.processingClaims} claims</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed (This Month)</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.completedAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{stats.completedClaims} claims</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgProcessingTime} days</div>
              <p className="text-xs text-muted-foreground">From approval to payment</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="batches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="batches">Reimbursement Batches</TabsTrigger>
          <TabsTrigger value="banking">Banking Integration</TabsTrigger>
          <TabsTrigger value="reports">Reports & Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reimbursement Batches</CardTitle>
              <CardDescription>
                Manage and track reimbursement batch processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {batches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No reimbursement batches found
                  </div>
                ) : (
                  batches.map((batch) => (
                    <Card key={batch.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{batch.batchId}</h3>
                              <Badge className={getStatusColor(batch.status)}>
                                {getStatusIcon(batch.status)}
                                <span className="ml-1">{batch.status}</span>
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                ₹{batch.totalAmount.toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {batch.totalClaims} claims
                              </span>
                              <span className="flex items-center gap-1">
                                <CreditCard className="h-4 w-4" />
                                {batch.paymentMethod}
                              </span>
                              {batch.referenceNumber && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-4 w-4" />
                                  {batch.referenceNumber}
                                </span>
                              )}
                            </div>
                            {batch.failureReason && (
                              <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{batch.failureReason}</AlertDescription>
                              </Alert>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {batch.status === 'PROCESSING' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleBankingIntegration(batch.id)}
                                  disabled={processingBatch === batch.id}
                                >
                                  <Building2 className="h-4 w-4 mr-1" />
                                  Banking File
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      Update Status
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Update Batch Status</DialogTitle>
                                      <DialogDescription>
                                        Update the status of batch {batch.batchId}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <BatchStatusUpdateForm
                                      batch={batch}
                                      onUpdate={handleBatchStatusUpdate}
                                      processing={processingBatch === batch.id}
                                    />
                                  </DialogContent>
                                </Dialog>
                              </>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendNotifications(batch.id, batch.status)}
                            >
                              <Mail className="h-4 w-4 mr-1" />
                              Notify
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedBatch(batch)}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Banking Integration Settings</CardTitle>
              <CardDescription>
                Configure banking provider and payment settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="banking-provider">Banking Provider</Label>
                  <Select value={bankingProvider} onValueChange={setBankingProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ICICI">ICICI Bank</SelectItem>
                      <SelectItem value="HDFC">HDFC Bank</SelectItem>
                      <SelectItem value="SBI">State Bank of India</SelectItem>
                      <SelectItem value="AXIS">Axis Bank</SelectItem>
                      <SelectItem value="KOTAK">Kotak Mahindra Bank</SelectItem>
                      <SelectItem value="MANUAL">Manual Processing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-mode">Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEFT">NEFT</SelectItem>
                      <SelectItem value="RTGS">RTGS</SelectItem>
                      <SelectItem value="IMPS">IMPS</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reports & Analytics</CardTitle>
              <CardDescription>
                Generate comprehensive reimbursement reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-20 flex-col">
                  <FileText className="h-6 w-6 mb-2" />
                  Summary Report
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Users className="h-6 w-6 mb-2" />
                  Employee Report
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <DollarSign className="h-6 w-6 mb-2" />
                  Payment Report
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Building2 className="h-6 w-6 mb-2" />
                  Compliance Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Batch Details Modal */}
      {selectedBatch && (
        <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Batch Details - {selectedBatch.batchId}</DialogTitle>
            </DialogHeader>
            <BatchDetailsView batch={selectedBatch} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// Batch Status Update Form Component
function BatchStatusUpdateForm({ 
  batch, 
  onUpdate, 
  processing 
}: { 
  batch: ReimbursementBatch
  onUpdate: (batchId: string, status: string, referenceNumber?: string, failureReason?: string) => void
  processing: boolean 
}) {
  const [status, setStatus] = useState('COMPLETED')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [failureReason, setFailureReason] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate(batch.id, status, referenceNumber || undefined, failureReason || undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {status === 'COMPLETED' && (
        <div className="space-y-2">
          <Label htmlFor="reference">Reference Number</Label>
          <Input
            id="reference"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Bank reference or transaction ID"
          />
        </div>
      )}

      {status === 'FAILED' && (
        <div className="space-y-2">
          <Label htmlFor="failure-reason">Failure Reason</Label>
          <Input
            id="failure-reason"
            value={failureReason}
            onChange={(e) => setFailureReason(e.target.value)}
            placeholder="Reason for failure"
            required
          />
        </div>
      )}

      <Button type="submit" disabled={processing} className="w-full">
        {processing ? 'Updating...' : 'Update Status'}
      </Button>
    </form>
  )
}

// Batch Details View Component
function BatchDetailsView({ batch }: { batch: ReimbursementBatch }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Batch ID</Label>
          <p className="text-sm text-muted-foreground">{batch.batchId}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Status</Label>
          <Badge className={`ml-2 ${batch.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
            batch.status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
            {batch.status}
          </Badge>
        </div>
        <div>
          <Label className="text-sm font-medium">Total Amount</Label>
          <p className="text-sm text-muted-foreground">₹{batch.totalAmount.toLocaleString()}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Total Claims</Label>
          <p className="text-sm text-muted-foreground">{batch.totalClaims}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Payment Method</Label>
          <p className="text-sm text-muted-foreground">{batch.paymentMethod}</p>
        </div>
        {batch.referenceNumber && (
          <div>
            <Label className="text-sm font-medium">Reference Number</Label>
            <p className="text-sm text-muted-foreground">{batch.referenceNumber}</p>
          </div>
        )}
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Expense Claims</Label>
        <div className="border rounded-lg">
          <div className="max-h-60 overflow-y-auto">
            {batch.expenseClaims.map((claim) => (
              <div key={claim.id} className="flex justify-between items-center p-3 border-b last:border-b-0">
                <div>
                  <p className="font-medium">{claim.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {claim.employee.firstName} {claim.employee.lastName} ({claim.employee.employeeCode})
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">₹{claim.amount.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
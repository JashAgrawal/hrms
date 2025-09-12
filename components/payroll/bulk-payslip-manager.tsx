'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Mail,
  Download,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

interface PayslipInfo {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  email: string
  fileName: string
  fileSize: number
  generatedAt: string
  emailSent: boolean
  emailSentAt?: string
  downloadCount: number
  status: string
}

interface BulkPayslipManagerProps {
  payrollRunId: string
  payrollRunPeriod: string
  onClose?: () => void
}

export default function BulkPayslipManager({
  payrollRunId,
  payrollRunPeriod,
  onClose,
}: BulkPayslipManagerProps) {
  const { data: session } = useSession()
  const [payslips, setPayslips] = useState<PayslipInfo[]>([])
  const [selectedPayslips, setSelectedPayslips] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDistributing, setIsDistributing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [distributionProgress, setDistributionProgress] = useState(0)
  const [distributionStatus, setDistributionStatus] = useState<any>(null)

  // Email customization
  const [customSubject, setCustomSubject] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [format, setFormat] = useState<'pdf' | 'html'>('pdf')
  const [batchSize, setBatchSize] = useState(5)

  // Dialog states
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showDistributeDialog, setShowDistributeDialog] = useState(false)

  useEffect(() => {
    fetchPayslips()
    fetchDistributionStatus()
  }, [payrollRunId])

  const fetchPayslips = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/payroll/payslips?payrollRunId=${payrollRunId}`)
      if (response.ok) {
        const data = await response.json()
        setPayslips(data.payslips)
      } else {
        setError('Failed to fetch payslips')
      }
    } catch (error) {
      console.error('Error fetching payslips:', error)
      setError('An error occurred while fetching payslips')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDistributionStatus = async () => {
    try {
      const response = await fetch(`/api/payroll/payslips/distribute?payrollRunId=${payrollRunId}`)
      if (response.ok) {
        const data = await response.json()
        setDistributionStatus(data.distributionStatus)
      }
    } catch (error) {
      console.error('Error fetching distribution status:', error)
    }
  }

  const handleGenerateBulkPayslips = async () => {
    try {
      setIsGenerating(true)
      setError(null)

      const response = await fetch('/api/payroll/payslips/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payrollRunId,
          format,
          emailDistribution: false,
          batchSize,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setShowGenerateDialog(false)
        await fetchPayslips()
        await fetchDistributionStatus()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to generate payslips')
      }
    } catch (error) {
      console.error('Error generating payslips:', error)
      setError('An error occurred while generating payslips')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDistributePayslips = async () => {
    try {
      setIsDistributing(true)
      setError(null)
      setDistributionProgress(0)

      const employeeIds = selectedPayslips.length > 0 
        ? selectedPayslips 
        : payslips.map(p => p.employeeId)

      const response = await fetch('/api/payroll/payslips/distribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payrollRunId,
          employeeIds: selectedPayslips.length > 0 ? selectedPayslips : undefined,
          customSubject: customSubject || undefined,
          customMessage: customMessage || undefined,
          batchSize,
          delayBetweenBatches: 1000,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDistributionProgress(100)
        setShowDistributeDialog(false)
        await fetchPayslips()
        await fetchDistributionStatus()
        setSelectedPayslips([])
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to distribute payslips')
      }
    } catch (error) {
      console.error('Error distributing payslips:', error)
      setError('An error occurred while distributing payslips')
    } finally {
      setIsDistributing(false)
      setDistributionProgress(0)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPayslips(payslips.map(p => p.employeeId))
    } else {
      setSelectedPayslips([])
    }
  }

  const handleSelectPayslip = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedPayslips(prev => [...prev, employeeId])
    } else {
      setSelectedPayslips(prev => prev.filter(id => id !== employeeId))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading payslips...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bulk Payslip Management</h2>
          <p className="text-gray-600">
            Manage payslips for {payrollRunPeriod}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={fetchPayslips}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center space-x-2 py-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Distribution Status */}
      {distributionStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Distribution Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {distributionStatus.totalPayslips}
                </div>
                <div className="text-sm text-gray-600">Total Payslips</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {distributionStatus.emailsSent}
                </div>
                <div className="text-sm text-gray-600">Emails Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {distributionStatus.emailsPending}
                </div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {distributionStatus.distributionRate}%
                </div>
                <div className="text-sm text-gray-600">Distribution Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button>
                <FileText className="h-4 w-4 mr-2" />
                Generate Payslips
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Bulk Payslips</DialogTitle>
                <DialogDescription>
                  Generate payslips for all approved payroll records in this run.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="format">Format</Label>
                  <Select value={format} onValueChange={(value: 'pdf' | 'html') => setFormat(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="batchSize">Batch Size</Label>
                  <Input
                    id="batchSize"
                    type="number"
                    min="1"
                    max="50"
                    value={batchSize}
                    onChange={(e) => setBatchSize(parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowGenerateDialog(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </Button>
                <Button onClick={handleGenerateBulkPayslips} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showDistributeDialog} onOpenChange={setShowDistributeDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={payslips.length === 0}>
                <Send className="h-4 w-4 mr-2" />
                Distribute via Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Distribute Payslips via Email</DialogTitle>
                <DialogDescription>
                  Send payslips to employees via email. 
                  {selectedPayslips.length > 0 
                    ? ` ${selectedPayslips.length} employees selected.`
                    : ' All employees will receive emails.'
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customSubject">Custom Subject (Optional)</Label>
                  <Input
                    id="customSubject"
                    placeholder="e.g., Your Salary Slip for March 2024"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="customMessage">Custom Message (Optional)</Label>
                  <Textarea
                    id="customMessage"
                    placeholder="Add a custom message to include in the email..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="emailBatchSize">Email Batch Size</Label>
                  <Input
                    id="emailBatchSize"
                    type="number"
                    min="1"
                    max="20"
                    value={batchSize}
                    onChange={(e) => setBatchSize(parseInt(e.target.value) || 5)}
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Number of emails to send simultaneously (recommended: 5-10)
                  </p>
                </div>
                {isDistributing && (
                  <div>
                    <Label>Distribution Progress</Label>
                    <Progress value={distributionProgress} className="mt-2" />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDistributeDialog(false)}
                  disabled={isDistributing}
                >
                  Cancel
                </Button>
                <Button onClick={handleDistributePayslips} disabled={isDistributing}>
                  {isDistributing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Distributing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Emails
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {payslips.length > 0 && (
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {selectedPayslips.length} of {payslips.length} selected
            </Badge>
          </div>
        )}
      </div>

      {/* Payslips Table */}
      {payslips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Payslips Generated</h3>
            <p className="text-gray-600 text-center max-w-md">
              Generate payslips for this payroll run to start managing and distributing them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Generated Payslips</span>
              <Badge variant="outline">{payslips.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedPayslips.length === payslips.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>File Size</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Email Status</TableHead>
                  <TableHead>Downloads</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((payslip) => (
                  <TableRow key={payslip.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPayslips.includes(payslip.employeeId)}
                        onCheckedChange={(checked) => 
                          handleSelectPayslip(payslip.employeeId, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payslip.employeeName}</div>
                        <div className="text-sm text-gray-600">{payslip.employeeCode}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{payslip.email}</TableCell>
                    <TableCell>{formatFileSize(payslip.fileSize)}</TableCell>
                    <TableCell className="text-sm">
                      {formatDate(payslip.generatedAt)}
                    </TableCell>
                    <TableCell>
                      {payslip.emailSent ? (
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">Sent</span>
                          {payslip.emailSentAt && (
                            <span className="text-xs text-gray-500">
                              {formatDate(payslip.emailSentAt)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-orange-600">Pending</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{payslip.downloadCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.open(
                              `/api/payroll/payslips/${payslip.id}?format=pdf&download=true`,
                              '_blank'
                            )
                          }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
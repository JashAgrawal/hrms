'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
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
import { 
  FileText, 
  Mail, 
  Download,
  Users,
  Send,
  Loader2,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'

interface PayrollRun {
  id: string
  period: string
  status: string
  startDate: string
  endDate: string
  totalNet?: number
  payrollRecords: Array<{
    id: string
    employee: {
      id: string
      employeeCode: string
      firstName: string
      lastName: string
      email: string
      designation: string
      department: {
        name: string
      }
    }
    netSalary: number
    status: string
  }>
}

interface BulkPayslipManagerProps {
  payrollRun: PayrollRun
  onRefresh?: () => void
}

interface EmailResult {
  sent: number
  failed: number
  errors?: string[]
}

interface GenerationResult {
  success?: number
  failed?: number
  totalPayslips?: number
  payslips?: Array<{
    html: string
    filename: string
  }>
  emailResults?: EmailResult
}

interface DistributionResult {
  results: {
    sent: number
    failed: number
  }
}

export default function BulkPayslipManager({ payrollRun, onRefresh }: BulkPayslipManagerProps) {
  const { data: session } = useSession()
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDistributing, setIsDistributing] = useState(false)
  const [isSendingEmails, setIsSendingEmails] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [showDistributeDialog, setShowDistributeDialog] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [distributionResult, setDistributionResult] = useState<DistributionResult | null>(null)
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [includeEmailDistribution, setIncludeEmailDistribution] = useState(false)

  const approvedRecords = payrollRun.payrollRecords.filter(
    record => ['APPROVED', 'PAID'].includes(record.status)
  )

  useEffect(() => {
    // Initialize with all approved employees selected
    setSelectedEmployees(approvedRecords.map(record => record.employee.id))
    
    // Set default email content
    const periodText = new Date(payrollRun.period + '-01').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    setEmailSubject(`Payslip for ${periodText}`)
    setEmailMessage(`Dear Employee,

Please find attached your payslip for ${periodText}.

If you have any questions regarding your payslip, please contact the HR department.

Best regards,
HR Team`)
  }, [payrollRun, approvedRecords])

  const handleEmployeeSelection = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees(prev => [...prev, employeeId])
    } else {
      setSelectedEmployees(prev => prev.filter(id => id !== employeeId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(approvedRecords.map(record => record.employee.id))
    } else {
      setSelectedEmployees([])
    }
  }

  const handleGeneratePayslips = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      setGenerationResult(null)

      const response = await fetch('/api/payroll/payslips/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payrollRunId: payrollRun.id,
          format: 'html',
          emailDistribution: includeEmailDistribution,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate payslips')
      }

      const result = await response.json()
      setGenerationResult(result)

      if (includeEmailDistribution && result.emailResults) {
        setEmailResult(result.emailResults)
      }

      if (onRefresh) {
        onRefresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDistributePayslips = async () => {
    try {
      setIsDistributing(true)
      setError(null)
      setDistributionResult(null)

      const response = await fetch('/api/payroll/payslips/distribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payrollRunId: payrollRun.id,
          employeeIds: selectedEmployees.length > 0 ? selectedEmployees : undefined,
          emailSubject,
          emailMessage,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to distribute payslips')
      }

      const result = await response.json()
      setDistributionResult(result)
      setShowDistributeDialog(false)
      
      if (onRefresh) {
        onRefresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsDistributing(false)
    }
  }

  const handleSendEmails = async () => {
    try {
      setIsSendingEmails(true)
      setError(null)

      const response = await fetch('/api/payroll/payslips/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payrollRunId: payrollRun.id,
          format: 'html',
          emailDistribution: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send emails')
      }

      const result = await response.json()
      setEmailResult(result.emailResults)
      setShowEmailDialog(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSendingEmails(false)
    }
  }

  const downloadAllPayslips = () => {
    if (!generationResult?.payslips) return

    // Create a zip-like structure by downloading individual files
    // In a real application, you would create a proper zip file
    generationResult.payslips.forEach((payslip, index) => {
      setTimeout(() => {
        const blob = new Blob([payslip.html], { type: 'text/html' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = payslip.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }, index * 100) // Stagger downloads to avoid browser blocking
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPeriod = (period: string) => {
    return new Date(period + '-01').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }

  // Check if user has permission
  if (!['ADMIN', 'HR', 'FINANCE'].includes(session?.user?.role || '')) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to manage payslips.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Bulk Payslip Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {generationResult && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Payslips generated successfully: {generationResult.success} successful, {generationResult.failed} failed
              </AlertDescription>
            </Alert>
          )}

          {distributionResult && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Payslips distributed: {distributionResult.results.sent} sent, {distributionResult.results.failed} failed
              </AlertDescription>
            </Alert>
          )}

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-blue-600">{approvedRecords.length}</p>
              <p className="text-sm text-gray-600">Approved Records</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <FileText className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <p className="text-lg font-bold text-green-600">{formatPeriod(payrollRun.period)}</p>
              <p className="text-sm text-gray-600">Pay Period</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(payrollRun.totalNet || 0)}
              </p>
              <p className="text-sm text-gray-600">Total Payout</p>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Generation Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Generation Options</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeEmail"
                checked={includeEmailDistribution}
                onCheckedChange={(checked) => setIncludeEmailDistribution(!!checked)}
                disabled={isGenerating}
              />
              <Label htmlFor="includeEmail" className="text-sm font-normal">
                Send payslips via email to employees
              </Label>
            </div>

            {includeEmailDistribution && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  Payslips will be automatically sent to each employee's registered email address.
                  Make sure all employee email addresses are up to date.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator className="my-6" />

          {/* Actions */}
          <div className="flex justify-center space-x-4">
            <Button
              onClick={handleGeneratePayslips}
              disabled={isGenerating || approvedRecords.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileText className="mr-2 h-4 w-4" />
              Generate Payslips
            </Button>

            {!includeEmailDistribution && generationResult && (
              <Button
                variant="outline"
                onClick={() => setShowEmailDialog(true)}
                disabled={isSendingEmails}
              >
                <Mail className="mr-2 h-4 w-4" />
                Send Emails
              </Button>
            )}

            <Dialog open={showDistributeDialog} onOpenChange={setShowDistributeDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={selectedEmployees.length === 0}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Distribute via Email ({selectedEmployees.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Distribute Payslips via Email</DialogTitle>
                  <DialogDescription>
                    Send payslips to selected employees via email
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailSubject">Email Subject</Label>
                    <Input
                      id="emailSubject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Enter email subject"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="emailMessage">Email Message</Label>
                    <Textarea
                      id="emailMessage"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Enter email message"
                      rows={6}
                    />
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    Payslips will be sent to {selectedEmployees.length} selected employees.
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowDistributeDialog(false)}
                    disabled={isDistributing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDistributePayslips}
                    disabled={isDistributing || !emailSubject.trim()}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isDistributing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="mr-2 h-4 w-4" />
                    Send Emails
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Results */}
          {generationResult && (
            <div className="mt-6 space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Successfully generated {generationResult.totalPayslips} payslips for {formatPeriod(payrollRun.period)}
                </AlertDescription>
              </Alert>

              <div className="flex justify-center space-x-4">
                <Button
                  variant="outline"
                  onClick={downloadAllPayslips}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download All Payslips
                </Button>
              </div>

              {emailResult && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Email Distribution Results</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">{emailResult.sent}</p>
                      <p className="text-sm text-gray-600">Sent</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{emailResult.failed}</p>
                      <p className="text-sm text-gray-600">Failed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{emailResult.sent + emailResult.failed}</p>
                      <p className="text-sm text-gray-600">Total</p>
                    </div>
                  </div>
                  
                  {emailResult.errors && emailResult.errors.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium text-red-600 mb-2">Errors:</h5>
                      <ul className="text-sm text-red-600 space-y-1">
                        {emailResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Employee Selection */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Employee Selection</CardTitle>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="selectAll"
                      checked={selectedEmployees.length === approvedRecords.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <Label htmlFor="selectAll" className="text-sm font-normal">
                      Select All ({approvedRecords.length})
                    </Label>
                  </div>
                  <Badge variant="outline">
                    {selectedEmployees.length} selected
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {approvedRecords.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Approved Records</h3>
                  <p className="text-gray-600">
                    No approved payroll records found for this period.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Select</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Net Salary</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvedRecords.map((record) => {
                        const isSelected = selectedEmployees.includes(record.employee.id)
                        
                        return (
                          <TableRow key={record.id}>
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => 
                                  handleEmployeeSelection(record.employee.id, !!checked)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {record.employee.firstName} {record.employee.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {record.employee.employeeCode} • {record.employee.designation}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {record.employee.email}
                            </TableCell>
                            <TableCell className="font-medium text-blue-600">
                              {formatCurrency(record.netSalary)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={record.status === 'PAID' ? 'default' : 'secondary'}>
                                {record.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Email Confirmation Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Payslip Emails</DialogTitle>
            <DialogDescription>
              Send payslips via email to {approvedRecords.length} employees for {formatPeriod(payrollRun.period)}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Each employee will receive their payslip as an HTML attachment via email.
                This action cannot be undone.
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium mb-2">Email Recipients:</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {approvedRecords.slice(0, 5).map((record) => (
                  <div key={record.id} className="text-sm">
                    {record.employee.firstName} {record.employee.lastName} ({record.employee.email})
                  </div>
                ))}
                {approvedRecords.length > 5 && (
                  <div className="text-sm text-gray-500">
                    ... and {approvedRecords.length - 5} more employees
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmails}
              disabled={isSendingEmails}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSendingEmails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Send Emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

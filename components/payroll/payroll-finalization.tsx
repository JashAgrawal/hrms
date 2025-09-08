'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Loader2, 
  CreditCard, 
  Download, 
  CheckCircle,
  DollarSign,
  Users,
  Calendar,
  FileText,
  AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'

const finalizationSchema = z.object({
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE']),
  paymentDate: z.string().min(1, 'Payment date is required'),
  bankFileGenerated: z.boolean().default(false),
  comments: z.string().optional(),
})

type FinalizationFormData = z.infer<typeof finalizationSchema>

interface PayrollRun {
  id: string
  period: string
  status: string
  totalGross?: number
  totalNet?: number
  totalDeductions?: number
  employeeCount?: number
  startDate: string
  endDate: string
  payrollRecords: Array<{
    id: string
    netSalary: number
    status: string
    employee: {
      employeeCode: string
      firstName: string
      lastName: string
      email: string
    }
  }>
}

interface PayrollFinalizationProps {
  payrollRun: PayrollRun
  onFinalizationComplete: (result: any) => void
  onCancel: () => void
}

export function PayrollFinalization({
  payrollRun,
  onFinalizationComplete,
  onCancel,
}: PayrollFinalizationProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bankFileData, setBankFileData] = useState<any>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(finalizationSchema),
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      bankFileGenerated: false,
    },
  }) as any

  const watchedPaymentMethod = watch('paymentMethod')
  const watchedBankFileGenerated = watch('bankFileGenerated')

  const handleFinalization = async (data: FinalizationFormData) => {
    try {
      setIsProcessing(true)
      setError(null)

      const response = await fetch(`/api/payroll/runs/${payrollRun.id}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          paymentDate: new Date(data.paymentDate).toISOString(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to finalize payroll')
      }

      const result = await response.json()
      
      if (result.bankFile) {
        setBankFileData(result.bankFile)
      }

      onFinalizationComplete(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsProcessing(false)
      setShowConfirmDialog(false)
    }
  }

  const handleFormSubmit = (data: FinalizationFormData) => {
    setShowConfirmDialog(true)
  }

  const downloadBankFile = () => {
    if (!bankFileData) return

    const csvContent = [
      'Serial No,Employee Code,Employee Name,Amount,Account Number,IFSC Code,Period',
      ...bankFileData.records.map((record: any) => 
        `${record.serialNo},${record.employeeCode},"${record.employeeName}",${record.amount},${record.accountNumber},${record.ifscCode},${record.period}`
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = bankFileData.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const approvedRecords = payrollRun.payrollRecords.filter(record => 
    ['APPROVED', 'CALCULATED'].includes(record.status)
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-green-600" />
            <span>Finalize Payroll - {payrollRun.period}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <p className="text-lg font-bold">{payrollRun.period}</p>
              <p className="text-sm text-gray-600">Pay Period</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-green-600">{approvedRecords.length}</p>
              <p className="text-sm text-gray-600">Approved Records</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(payrollRun.totalNet || 0)}
              </p>
              <p className="text-sm text-gray-600">Total Payout</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-orange-600" />
              <p className="text-lg font-bold">
                <Badge variant="outline" className="text-orange-600">
                  {payrollRun.status}
                </Badge>
              </p>
              <p className="text-sm text-gray-600">Current Status</p>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Payment Details Form */}
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select
                  value={watchedPaymentMethod}
                  onValueChange={(value) => setValue('paymentMethod', value as any)}
                  disabled={isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
                {errors.paymentMethod && (
                  <p className="text-sm text-red-600">{errors.paymentMethod.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment Date *</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  {...register('paymentDate')}
                  disabled={isProcessing}
                />
                {errors.paymentDate && (
                  <p className="text-sm text-red-600">{errors.paymentDate.message}</p>
                )}
              </div>
            </div>

            {watchedPaymentMethod === 'BANK_TRANSFER' && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bankFileGenerated"
                    checked={watchedBankFileGenerated}
                    onCheckedChange={(checked) => setValue('bankFileGenerated', !!checked)}
                    disabled={isProcessing}
                  />
                  <Label htmlFor="bankFileGenerated" className="text-sm font-normal">
                    Generate bank file for salary transfer
                  </Label>
                </div>
                
                {watchedBankFileGenerated && (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      A CSV file will be generated with employee bank details for bulk salary transfer.
                      Please ensure all employee bank details are updated before proceeding.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                {...register('comments')}
                placeholder="Optional comments about the payment processing"
                disabled={isProcessing}
                rows={3}
              />
            </div>

            <Separator />

            {/* Employee List Preview */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Employees to be Paid ({approvedRecords.length})</h3>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <div className="space-y-1 p-2">
                  {approvedRecords.map((record) => (
                    <div key={record.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">
                          {record.employee.firstName} {record.employee.lastName}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          ({record.employee.employeeCode})
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{record.status}</Badge>
                        <span className="font-medium text-green-600">
                          {formatCurrency(record.netSalary)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || !watchedPaymentMethod}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Finalize Payroll
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Bank File Download */}
      {bankFileData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="h-5 w-5 text-blue-600" />
              <span>Bank File Generated</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="font-medium">{bankFileData.fileName}</p>
                <p className="text-sm text-gray-600">
                  {bankFileData.totalRecords} records • Total: {formatCurrency(bankFileData.totalAmount)}
                </p>
              </div>
              <Button onClick={downloadBankFile} className="bg-blue-600 hover:bg-blue-700">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payroll Finalization</DialogTitle>
            <DialogDescription>
              Are you sure you want to finalize this payroll? This action will mark all approved 
              salary records as paid and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-yellow-800">Important</span>
              </div>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• {approvedRecords.length} employees will be marked as paid</li>
                <li>• Total payout: {formatCurrency(payrollRun.totalNet || 0)}</li>
                <li>• Payment method: {watchedPaymentMethod}</li>
                <li>• This action cannot be reversed</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit(handleFinalization)}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Finalization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
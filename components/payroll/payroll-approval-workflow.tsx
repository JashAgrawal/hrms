'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Trash2,
  DollarSign,
  Users,
  AlertTriangle,
  Edit
} from 'lucide-react'

const adjustmentSchema = z.object({
  recordId: z.string(),
  adjustmentType: z.enum(['BONUS', 'DEDUCTION', 'CORRECTION']),
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().min(1, 'Reason is required'),
})

const approvalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().optional(),
  adjustments: z.array(adjustmentSchema).optional(),
})

type ApprovalFormData = z.infer<typeof approvalSchema>

interface PayrollRecord {
  id: string
  employeeId: string
  basicSalary: number
  grossSalary: number
  netSalary: number
  totalEarnings: number
  totalDeductions: number
  workingDays: number
  presentDays: number
  status: string
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
}

interface PayrollRun {
  id: string
  period: string
  status: string
  totalGross?: number
  totalNet?: number
  totalDeductions?: number
  employeeCount?: number
  payrollRecords: PayrollRecord[]
}

interface PayrollApprovalWorkflowProps {
  payrollRun: PayrollRun
  onApprovalComplete: (result: any) => void
  onCancel: () => void
}

export function PayrollApprovalWorkflow({
  payrollRun,
  onApprovalComplete,
  onCancel,
}: PayrollApprovalWorkflowProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    control,
  } = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
      adjustments: [],
    },
  })

  const { fields: adjustments, append: addAdjustment, remove: removeAdjustment } = useFieldArray({
    control,
    name: 'adjustments',
  })

  const watchedAction = watch('action')

  const handleApproval = async (data: ApprovalFormData) => {
    try {
      setIsProcessing(true)
      setError(null)

      const response = await fetch(`/api/payroll/runs/${payrollRun.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process approval')
      }

      const result = await response.json()
      onApprovalComplete(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddAdjustment = (record: PayrollRecord) => {
    setSelectedRecord(record)
    setShowAdjustmentDialog(true)
  }

  const confirmAdjustment = (adjustmentData: any) => {
    addAdjustment({
      recordId: selectedRecord!.id,
      adjustmentType: adjustmentData.type,
      amount: adjustmentData.amount,
      reason: adjustmentData.reason,
    })
    setShowAdjustmentDialog(false)
    setSelectedRecord(null)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getAdjustmentForRecord = (recordId: string) => {
    return adjustments.find(adj => adj.recordId === recordId)
  }

  const calculateAdjustedAmount = (record: PayrollRecord) => {
    const adjustment = getAdjustmentForRecord(record.id)
    if (!adjustment) return record.netSalary

    switch (adjustment.adjustmentType) {
      case 'BONUS':
        return record.netSalary + adjustment.amount
      case 'DEDUCTION':
        return record.netSalary - adjustment.amount
      case 'CORRECTION':
        return adjustment.amount
      default:
        return record.netSalary
    }
  }

  const getTotalAdjustedAmount = () => {
    return payrollRun.payrollRecords.reduce((total, record) => {
      return total + calculateAdjustedAmount(record)
    }, 0)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <span>Payroll Approval - {payrollRun.period}</span>
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
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-2 text-gray-600" />
              <p className="text-2xl font-bold">{payrollRun.payrollRecords.length}</p>
              <p className="text-sm text-gray-600">Employees</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(payrollRun.totalGross || 0)}
              </p>
              <p className="text-sm text-gray-600">Total Gross</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(payrollRun.totalNet || 0)}
              </p>
              <p className="text-sm text-gray-600">Original Net</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(getTotalAdjustedAmount())}
              </p>
              <p className="text-sm text-gray-600">Adjusted Net</p>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Payroll Records Table */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4">Employee Payroll Records</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Gross Salary</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Adjusted Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRun.payrollRecords.map((record) => {
                    const adjustment = getAdjustmentForRecord(record.id)
                    const adjustedAmount = calculateAdjustedAmount(record)
                    const hasAdjustment = adjustedAmount !== record.netSalary

                    return (
                      <TableRow key={record.id}>
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
                        <TableCell className="font-medium text-green-600">
                          {formatCurrency(record.grossSalary)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(record.netSalary)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className={`font-medium ${hasAdjustment ? 'text-purple-600' : ''}`}>
                              {formatCurrency(adjustedAmount)}
                            </span>
                            {hasAdjustment && (
                              <Badge variant="outline" className="text-xs">
                                {adjustment?.adjustmentType}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{record.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddAdjustment(record)}
                            disabled={isProcessing}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Adjustments Summary */}
          {adjustments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">Pending Adjustments</h3>
              <div className="space-y-2">
                {adjustments.map((adjustment, index) => {
                  const record = payrollRun.payrollRecords.find(r => r.id === adjustment.recordId)
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <span className="font-medium">
                          {record?.employee.firstName} {record?.employee.lastName}
                        </span>
                        <span className="mx-2">•</span>
                        <Badge variant="outline">{adjustment.adjustmentType}</Badge>
                        <span className="mx-2">•</span>
                        <span className="font-medium">{formatCurrency(adjustment.amount)}</span>
                        <div className="text-sm text-gray-600 mt-1">{adjustment.reason}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAdjustment(index)}
                        disabled={isProcessing}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(handleApproval)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="action">Approval Decision *</Label>
              <Select
                value={watchedAction}
                onValueChange={(value) => setValue('action', value as 'approve' | 'reject')}
                disabled={isProcessing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Approve Payroll</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="reject">
                    <div className="flex items-center space-x-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span>Reject Payroll</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.action && (
                <p className="text-sm text-red-600">{errors.action.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                {...register('comments')}
                placeholder="Optional comments about the approval decision"
                disabled={isProcessing}
                rows={3}
              />
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
                disabled={isProcessing || !watchedAction}
                className={watchedAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {watchedAction === 'approve' ? 'Approve Payroll' : 'Reject Payroll'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Adjustment Dialog */}
      <AdjustmentDialog
        open={showAdjustmentDialog}
        onOpenChange={setShowAdjustmentDialog}
        record={selectedRecord}
        onConfirm={confirmAdjustment}
      />
    </div>
  )
}

// Adjustment Dialog Component
interface AdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: PayrollRecord | null
  onConfirm: (data: any) => void
}

function AdjustmentDialog({ open, onOpenChange, record, onConfirm }: AdjustmentDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<'BONUS' | 'DEDUCTION' | 'CORRECTION'>('BONUS')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    if (!amount || !reason) return

    onConfirm({
      type: adjustmentType,
      amount: parseFloat(amount),
      reason,
    })

    // Reset form
    setAmount('')
    setReason('')
    setAdjustmentType('BONUS')
  }

  if (!record) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payroll Adjustment</DialogTitle>
          <DialogDescription>
            Add an adjustment for {record.employee.firstName} {record.employee.lastName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <Select value={adjustmentType} onValueChange={(value: any) => setAdjustmentType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BONUS">Bonus</SelectItem>
                <SelectItem value="DEDUCTION">Deduction</SelectItem>
                <SelectItem value="CORRECTION">Correction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
            />
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for adjustment"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!amount || !reason}>
            Add Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
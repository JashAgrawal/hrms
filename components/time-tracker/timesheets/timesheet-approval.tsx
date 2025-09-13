'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  AlertTriangle,
  Edit3,
  MessageSquare,
  History
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { TimesheetWithEmployee, TimeEntryWithProject } from '@/components/time-tracker/shared/prisma-types'

// Validation schema
const ApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional(),
  adjustments: z.array(z.object({
    entryId: z.string(),
    field: z.enum(['billableHours', 'nonBillableHours', 'overtimeHours', 'taskDescription']),
    oldValue: z.union([z.string(), z.number()]),
    newValue: z.union([z.string(), z.number()]),
    reason: z.string()
  })).optional()
})

type ApprovalFormData = z.infer<typeof ApprovalSchema>





interface ApprovalHistory {
  id: string
  action: string
  createdAt: string
  details: any
  user: {
    id: string
    name: string
  }
}

interface TimesheetApprovalProps {
  timesheet: TimesheetWithEmployee
  approvalHistory: ApprovalHistory[]
  canApprove: boolean
  onApprove: (data: ApprovalFormData) => Promise<void>
  onClose: () => void
  isLoading?: boolean
}

export function TimesheetApproval({
  timesheet,
  approvalHistory,
  canApprove,
  onApprove,
  onClose,
  isLoading = false
}: TimesheetApprovalProps) {
  const { toast } = useToast()
  const [showAdjustments, setShowAdjustments] = useState(false)
  const [adjustments, setAdjustments] = useState<ApprovalFormData['adjustments']>([])

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(ApprovalSchema),
    defaultValues: {
      action: 'APPROVE',
      comments: '',
      adjustments: []
    }
  })

  const watchedAction = form.watch('action')

  // Add adjustment
  const addAdjustment = (entry: TimeEntryWithProject, field: string, newValue: string | number) => {
    const oldValue = entry[field as keyof TimeEntryWithProject] as string | number
    if (oldValue === newValue || !entry.id) return

    const newAdjustment = {
      entryId: entry.id,
      field: field as any,
      oldValue,
      newValue,
      reason: ''
    }

    setAdjustments(prev => {
      const filtered = prev?.filter(adj => !(adj.entryId === entry.id && adj.field === field)) || []
      return [...filtered, newAdjustment]
    })
  }

  // Remove adjustment
  const removeAdjustment = (entryId: string, field: string) => {
    setAdjustments(prev => prev?.filter(adj => !(adj.entryId === entryId && adj.field === field)) || [])
  }

  // Update adjustment reason
  const updateAdjustmentReason = (entryId: string, field: string, reason: string) => {
    setAdjustments(prev => 
      prev?.map(adj => 
        adj.entryId === entryId && adj.field === field 
          ? { ...adj, reason }
          : adj
      ) || []
    )
  }

  // Handle form submission
  const handleSubmit = async (data: ApprovalFormData) => {
    try {
      const submissionData = {
        ...data,
        adjustments: adjustments?.filter(adj => adj.reason.trim() !== '') || []
      }
      
      await onApprove(submissionData)
      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process approval',
        variant: 'destructive'
      })
    }
  }

  // Calculate totals
  const totalBillableHours = timesheet.entries.reduce((sum, entry) => sum + Number(entry.billableHours), 0)
  const totalNonBillableHours = timesheet.entries.reduce((sum, entry) => sum + Number(entry.nonBillableHours), 0)
  const totalOvertimeHours = timesheet.entries.reduce((sum, entry) => sum + Number(entry.overtimeHours), 0)

  // Get unique projects
  const uniqueProjects = Array.from(
    new Set(timesheet.entries.map(e => e.project?.name).filter(Boolean))
  ) as string[]

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timesheet Approval
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Timesheet Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timesheet Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Employee</span>
                  </div>
                  <div>
                    <p className="font-semibold">
                      {timesheet.employee.firstName} {timesheet.employee.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {timesheet.employee.employeeId}
                      {timesheet.employee.department && ` • ${timesheet.employee.department.name}`}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Period</span>
                  </div>
                  <div>
                    <p className="font-semibold">
                      {format(new Date(timesheet.startDate), 'MMM dd')} - {format(new Date(timesheet.endDate), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {timesheet.entries.length} entries
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Hours Summary</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Billable:</span>
                      <span className="font-medium">{Number(totalBillableHours).toFixed(2)}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Non-billable:</span>
                      <span className="font-medium">{Number(totalNonBillableHours).toFixed(2)}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Overtime:</span>
                      <span className="font-medium">{Number(totalOvertimeHours).toFixed(2)}h</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>{Number(timesheet.totalHours).toFixed(2)}h</span>
                    </div>
                  </div>
                </div>
              </div>

              {uniqueProjects.length > 0 && (
                <div className="mt-4">
                  <span className="font-medium text-sm">Projects: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {uniqueProjects.map((project, index) => (
                      <Badge key={index} variant="outline">
                        {project}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {timesheet.submittedAt && (
                <div className="mt-4 text-sm text-muted-foreground">
                  Submitted on {format(new Date(timesheet.submittedAt), 'MMM dd, yyyy \'at\' h:mm a')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time Entries */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Time Entries</CardTitle>
                {canApprove && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdjustments(!showAdjustments)}
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    {showAdjustments ? 'Hide' : 'Make'} Adjustments
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Billable</TableHead>
                      <TableHead>Non-Bill</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheet.entries.map((entry) => {
                      const hasAdjustments = adjustments?.some(adj => adj.entryId === entry.id)
                      
                      return (
                        <TableRow key={entry.id} className={hasAdjustments ? 'bg-yellow-50' : ''}>
                          <TableCell>
                            <div className="font-medium">
                              {format(new Date(entry.date), 'MMM dd')}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(entry.date), 'EEEE')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {entry.startTime} - {entry.endTime}
                            </div>
                            {entry.breakDuration > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Break: {entry.breakDuration}min
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.project ? (
                              <Badge variant="outline">
                                {entry.project.code}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">No project</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {showAdjustments && canApprove ? (
                              <Input
                                type="number"
                                step="0.25"
                                defaultValue={Number(entry.billableHours)}
                                className="w-20"
                                onChange={(e) => addAdjustment(entry, 'billableHours', parseFloat(e.target.value) || 0)}
                              />
                            ) : (
                              <span className="font-medium">{Number(entry.billableHours)}h</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {showAdjustments && canApprove ? (
                              <Input
                                type="number"
                                step="0.25"
                                defaultValue={Number(entry.nonBillableHours)}
                                className="w-20"
                                onChange={(e) => addAdjustment(entry, 'nonBillableHours', parseFloat(e.target.value) || 0)}
                              />
                            ) : (
                              <span className="font-medium">{Number(entry.nonBillableHours)}h</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {showAdjustments && canApprove ? (
                              <Input
                                type="number"
                                step="0.25"
                                defaultValue={Number(entry.overtimeHours)}
                                className="w-20"
                                onChange={(e) => addAdjustment(entry, 'overtimeHours', parseFloat(e.target.value) || 0)}
                              />
                            ) : (
                              <span className="font-medium">{Number(entry.overtimeHours)}h</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {showAdjustments && canApprove ? (
                                <Textarea
                                  defaultValue={entry.taskDescription || ''}
                                  className="min-h-[60px]"
                                  onChange={(e) => addAdjustment(entry, 'taskDescription', e.target.value)}
                                />
                              ) : (
                                <p className="text-sm">{entry.taskDescription || 'No description'}</p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Adjustments Summary */}
              {adjustments && adjustments.length > 0 && (
                <div className="mt-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">Adjustments to be made:</p>
                        {adjustments.map((adj, index) => (
                          <div key={index} className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <span>
                                {adj.field}: {String(adj.oldValue)} → {String(adj.newValue)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAdjustment(adj.entryId, adj.field)}
                              >
                                Remove
                              </Button>
                            </div>
                            <Input
                              placeholder="Reason for adjustment..."
                              value={adj.reason}
                              onChange={(e) => updateAdjustmentReason(adj.entryId, adj.field, e.target.value)}
                              className="text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval History */}
          {approvalHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Approval History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {approvalHistory.map((history) => (
                    <div key={history.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-shrink-0">
                        {history.action.includes('APPROVED') ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : history.action.includes('REJECTED') ? (
                          <XCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <MessageSquare className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{history.user.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(history.createdAt), 'MMM dd, yyyy \'at\' h:mm a')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {history.action.replace('TIMESHEET_', '').replace('_', ' ').toLowerCase()}
                        </p>
                        {history.details?.comments && (
                          <p className="text-sm mt-2 p-2 bg-background rounded border">
                            {history.details.comments}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval Form */}
          {canApprove && timesheet.status === 'SUBMITTED' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Approval Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant={watchedAction === 'APPROVE' ? 'default' : 'outline'}
                        onClick={() => form.setValue('action', 'APPROVE')}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant={watchedAction === 'REJECT' ? 'destructive' : 'outline'}
                        onClick={() => form.setValue('action', 'REJECT')}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>

                    <FormField
                      control={form.control}
                      name="comments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Comments {watchedAction === 'REJECT' && <span className="text-destructive">*</span>}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={
                                watchedAction === 'APPROVE' 
                                  ? "Add any comments about the approval..." 
                                  : "Please provide a reason for rejection..."
                              }
                              {...field}
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        variant={watchedAction === 'APPROVE' ? 'default' : 'destructive'}
                      >
                        {isLoading ? 'Processing...' : `${watchedAction === 'APPROVE' ? 'Approve' : 'Reject'} Timesheet`}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Status Alert */}
          {!canApprove && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You don't have permission to approve this timesheet or it's not in a submittable state.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

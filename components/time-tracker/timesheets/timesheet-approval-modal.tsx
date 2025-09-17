'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle, XCircle, Clock, User, Calendar, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface TimesheetEntry {
  id: string
  date: string
  startTime: string
  endTime: string
  breakDuration: number
  projectId?: string
  project?: {
    name: string
    code: string
    clientName?: string
  }
  taskDescription?: string
  billableHours: number
  nonBillableHours: number
  overtimeHours: number
}

interface Timesheet {
  id: string
  startDate: string
  endDate: string
  status: string
  submittedAt?: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    email: string
  }
  entries: TimesheetEntry[]
  comments?: string
}

interface TimesheetApprovalModalProps {
  timesheet: Timesheet | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (timesheetId: string, comments?: string) => Promise<void>
  onReject: (timesheetId: string, comments: string) => Promise<void>
  isLoading?: boolean
}

export function TimesheetApprovalModal({
  timesheet,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isLoading = false
}: TimesheetApprovalModalProps) {
  const [comments, setComments] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)

  if (!timesheet) return null

  const totalBillableHours = timesheet.entries.reduce((sum, entry) => sum + entry.billableHours, 0)
  const totalNonBillableHours = timesheet.entries.reduce((sum, entry) => sum + entry.nonBillableHours, 0)
  const totalOvertimeHours = timesheet.entries.reduce((sum, entry) => sum + entry.overtimeHours, 0)
  const totalHours = totalBillableHours + totalNonBillableHours + totalOvertimeHours

  const uniqueProjects = Array.from(
    new Set(timesheet.entries.map(e => e.project?.name).filter(Boolean))
  ) as string[]

  const handleApprove = async () => {
    try {
      setAction('approve')
      await onApprove(timesheet.id, comments.trim() || undefined)
      toast.success('Timesheet approved successfully')
      setComments('')
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to approve timesheet')
    } finally {
      setAction(null)
    }
  }

  const handleReject = async () => {
    if (!comments.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    try {
      setAction('reject')
      await onReject(timesheet.id, comments.trim())
      toast.success('Timesheet rejected')
      setComments('')
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to reject timesheet')
    } finally {
      setAction(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timesheet Approval
          </DialogTitle>
          <DialogDescription>
            Review and approve or reject the submitted timesheet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee & Timesheet Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Employee Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Name:</span>
                  <span className="ml-2">{timesheet.employee.firstName} {timesheet.employee.lastName}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">Employee ID:</span>
                  <span className="ml-2">{timesheet.employee.employeeCode}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">Email:</span>
                  <span className="ml-2">{timesheet.employee.email}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Timesheet Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Period:</span>
                  <span className="ml-2">
                    {format(new Date(timesheet.startDate), 'MMM dd')} - {format(new Date(timesheet.endDate), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium">Status:</span>
                  <Badge className={`ml-2 ${getStatusColor(timesheet.status)}`}>
                    {timesheet.status}
                  </Badge>
                </div>
                {timesheet.submittedAt && (
                  <div>
                    <span className="text-sm font-medium">Submitted:</span>
                    <span className="ml-2">{format(new Date(timesheet.submittedAt), 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalBillableHours.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Billable Hours</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{totalNonBillableHours.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Non-Billable Hours</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{totalOvertimeHours.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Overtime Hours</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{totalHours.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Total Hours</div>
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
            </CardContent>
          </Card>

          {/* Time Entries */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Billable</TableHead>
                      <TableHead>Non-Billable</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheet.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {format(new Date(entry.date), 'MMM dd')}
                        </TableCell>
                        <TableCell>
                          {entry.startTime} - {entry.endTime}
                          {entry.breakDuration > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Break: {entry.breakDuration}min
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.project ? (
                            <div>
                              <div className="font-medium">{entry.project.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {entry.project.code}
                                {entry.project.clientName && ` • ${entry.project.clientName}`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No project</span>
                          )}
                        </TableCell>
                        <TableCell>{entry.billableHours}h</TableCell>
                        <TableCell>{entry.nonBillableHours}h</TableCell>
                        <TableCell>{entry.overtimeHours}h</TableCell>
                        <TableCell>
                          {entry.taskDescription ? (
                            <div className="max-w-xs truncate" title={entry.taskDescription}>
                              {entry.taskDescription}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No description</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Comments Section */}
          <div className="space-y-2">
            <Label htmlFor="comments" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments {timesheet.status === 'SUBMITTED' && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="comments"
              placeholder={
                timesheet.status === 'SUBMITTED' 
                  ? "Add comments for approval/rejection (required for rejection)..."
                  : "Add comments..."
              }
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              disabled={isLoading || action !== null}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading || action !== null}
          >
            Close
          </Button>
          
          {timesheet.status === 'SUBMITTED' && (
            <>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isLoading || action !== null}
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                {action === 'reject' ? 'Rejecting...' : 'Reject'}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isLoading || action !== null}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {action === 'approve' ? 'Approving...' : 'Approve'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
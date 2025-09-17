'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Clock, User, Calendar, CheckCircle, XCircle, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { TimesheetApprovalModal } from '@/components/time-tracker/timesheets/timesheet-approval-modal'

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  email: string
}

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
  approvedAt?: string
  rejectedAt?: string
  comments?: string
  employee: Employee
  entries: TimesheetEntry[]
}

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800 border-gray-200',
  SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200'
}

export default function TimesheetManagePage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Fetch timesheets
  const fetchTimesheets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      const res = await fetch(`/api/timesheets/manage?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch timesheets')

      const data = await res.json()
      setTimesheets(data.timesheets || [])
    } catch (error) {
      console.error('Error fetching timesheets:', error)
      toast.error('Failed to fetch timesheets')
    } finally {
      setLoading(false)
    }
  }

  // Approve timesheet
  const handleApprove = async (timesheetId: string, comments?: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/timesheets/${timesheetId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve timesheet')
      }

      await fetchTimesheets()
    } finally {
      setActionLoading(false)
    }
  }

  // Reject timesheet
  const handleReject = async (timesheetId: string, comments: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/timesheets/${timesheetId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reject timesheet')
      }

      await fetchTimesheets()
    } finally {
      setActionLoading(false)
    }
  }

  // View timesheet details
  const handleViewTimesheet = (timesheet: Timesheet) => {
    setSelectedTimesheet(timesheet)
    setShowApprovalModal(true)
  }

  // Calculate total hours for a timesheet
  const getTotalHours = (entries: TimesheetEntry[]) => {
    return entries.reduce((sum, entry) => 
      sum + entry.billableHours + entry.nonBillableHours + entry.overtimeHours, 0
    )
  }

  useEffect(() => {
    fetchTimesheets()
  }, [searchQuery, statusFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timesheet Management</h1>
          <p className="text-muted-foreground">
            Review and approve employee timesheets
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by employee name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="SUBMITTED">Pending Approval</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timesheets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Timesheets ({timesheets.length})</CardTitle>
          <CardDescription>
            Manage employee timesheet submissions and approvals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading timesheets...</div>
            </div>
          ) : timesheets.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">No timesheets found</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Last Action</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.map((timesheet) => {
                    const totalHours = getTotalHours(timesheet.entries)
                    
                    return (
                      <TableRow key={timesheet.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {timesheet.employee.firstName} {timesheet.employee.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {timesheet.employee.employeeCode}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {format(new Date(timesheet.startDate), 'MMM dd')} - {format(new Date(timesheet.endDate), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[timesheet.status as keyof typeof statusColors]}>
                            {timesheet.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {totalHours.toFixed(1)}h
                          </div>
                        </TableCell>
                        <TableCell>
                          {timesheet.submittedAt ? (
                            format(new Date(timesheet.submittedAt), 'MMM dd, HH:mm')
                          ) : (
                            <span className="text-muted-foreground">Not submitted</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {timesheet.approvedAt && (
                            <span className="text-green-600 text-sm">
                              Approved {format(new Date(timesheet.approvedAt), 'MMM dd')}
                            </span>
                          )}
                          {timesheet.rejectedAt && (
                            <span className="text-red-600 text-sm">
                              Rejected {format(new Date(timesheet.rejectedAt), 'MMM dd')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewTimesheet(timesheet)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {timesheet.status === 'SUBMITTED' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => handleApprove(timesheet.id)}
                                  disabled={actionLoading}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleViewTimesheet(timesheet)}
                                  disabled={actionLoading}
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
        </CardContent>
      </Card>

      {/* Approval Modal */}
      <TimesheetApprovalModal
        timesheet={selectedTimesheet}
        open={showApprovalModal}
        onOpenChange={setShowApprovalModal}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={actionLoading}
      />
    </div>
  )
}
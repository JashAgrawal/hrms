'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { 
  Search, 
  Filter, 
  Edit, 
  Eye, 
  Trash2, 
  MoreHorizontal, 
  CheckCircle, 
  XCircle, 
  Clock,
  Calendar,
  Download,
  Send
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { TimesheetWithEmployee, TimesheetStatus } from '@/components/time-tracker/shared/prisma-types'

interface TimesheetListProps {
  timesheets: TimesheetWithEmployee[]
  totalCount: number
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onSearch: (query: string) => void
  onFilter: (filters: { status?: string; employeeId?: string; projectId?: string }) => void
  onEdit: (timesheet: TimesheetWithEmployee) => void
  onView: (timesheet: TimesheetWithEmployee) => void
  onDelete: (timesheetIds: string[]) => void
  onBulkApprove: (timesheetIds: string[], action: 'APPROVE' | 'REJECT', comments?: string) => void
  onBulkSubmit: (timesheetIds: string[]) => void
  onExport: (timesheetIds: string[]) => void
  canApprove?: boolean
  canEdit?: boolean
  canDelete?: boolean
  isLoading?: boolean
}

export function TimesheetList({
  timesheets,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  onSearch,
  onFilter,
  onEdit,
  onView,
  onDelete,
  onBulkApprove,
  onBulkSubmit,
  onExport,
  canApprove = false,
  canEdit = true,
  canDelete = true,
  isLoading = false
}: TimesheetListProps) {
  const { toast } = useToast()
  const [selectedTimesheets, setSelectedTimesheets] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    onSearch(query)
  }

  // Handle status filter
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    onFilter({ status: status || undefined })
  }

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTimesheets(timesheets.map(t => t.id))
    } else {
      setSelectedTimesheets([])
    }
  }

  // Handle individual selection
  const handleSelectTimesheet = (timesheetId: string, checked: boolean) => {
    if (checked) {
      setSelectedTimesheets(prev => [...prev, timesheetId])
    } else {
      setSelectedTimesheets(prev => prev.filter(id => id !== timesheetId))
    }
  }

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'default'
      case 'SUBMITTED': return 'secondary'
      case 'REJECTED': return 'destructive'
      case 'DRAFT': return 'outline'
      default: return 'outline'
    }
  }

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle className="h-3 w-3" />
      case 'REJECTED': return <XCircle className="h-3 w-3" />
      case 'SUBMITTED': return <Clock className="h-3 w-3" />
      default: return <Edit className="h-3 w-3" />
    }
  }

  // Handle bulk actions
  const handleBulkAction = async (action: string) => {
    if (selectedTimesheets.length === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select timesheets to perform bulk actions',
        variant: 'destructive'
      })
      return
    }

    try {
      switch (action) {
        case 'approve':
          await onBulkApprove(selectedTimesheets, 'APPROVE')
          break
        case 'reject':
          await onBulkApprove(selectedTimesheets, 'REJECT')
          break
        case 'submit':
          await onBulkSubmit(selectedTimesheets)
          break
        case 'delete':
          await onDelete(selectedTimesheets)
          break
        case 'export':
          await onExport(selectedTimesheets)
          break
      }
      setSelectedTimesheets([])
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${action} timesheets`,
        variant: 'destructive'
      })
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const hasSelection = selectedTimesheets.length > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timesheets
            <Badge variant="secondary" className="ml-2">
              {totalCount}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasSelection && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Bulk Actions ({selectedTimesheets.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canApprove && (
                    <>
                      <DropdownMenuItem onClick={() => handleBulkAction('approve')}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve Selected
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkAction('reject')}>
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject Selected
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => handleBulkAction('submit')}>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction('export')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Selected
                  </DropdownMenuItem>
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleBulkAction('delete')}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search timesheets..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {showFilters && (
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedTimesheets.length === timesheets.length && timesheets.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Approved By</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading timesheets...
                  </TableCell>
                </TableRow>
              ) : timesheets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    No timesheets found
                  </TableCell>
                </TableRow>
              ) : (
                timesheets.map((timesheet) => {
                  const isSelected = selectedTimesheets.includes(timesheet.id)
                  const uniqueProjects = Array.from(
                    new Set(timesheet.entries.map((e: any) => e.project?.name).filter(Boolean))
                  ) as string[]

                  return (
                    <TableRow key={timesheet.id} className={isSelected ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectTimesheet(timesheet.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {timesheet.employee.firstName} {timesheet.employee.lastName}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {timesheet.employee.employeeId}
                            {timesheet.employee.department && ` • ${timesheet.employee.department.name}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(new Date(timesheet.startDate), 'MMM dd')} - {format(new Date(timesheet.endDate), 'MMM dd, yyyy')}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {timesheet.entries.length} entries
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(timesheet.status)} className="gap-1">
                          {getStatusIcon(timesheet.status)}
                          {timesheet.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{Number(timesheet.totalHours).toFixed(2)}h</span>
                          <span className="text-sm text-muted-foreground">
                            {timesheet.entries.reduce((sum: number, e: any) => sum + Number(e.billableHours), 0).toFixed(1)}h billable
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {uniqueProjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {uniqueProjects.slice(0, 2).map((project, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {project}
                              </Badge>
                            ))}
                            {uniqueProjects.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{uniqueProjects.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No projects</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {timesheet.submittedAt ? (
                          <span className="text-sm">
                            {format(new Date(timesheet.submittedAt), 'MMM dd, yyyy')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not submitted</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {timesheet.approver ? (
                          <span className="text-sm">{timesheet.approver.name}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(timesheet)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {canEdit && timesheet.status !== 'APPROVED' && (
                              <DropdownMenuItem onClick={() => onEdit(timesheet)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onExport([timesheet.id])}>
                              <Download className="h-4 w-4 mr-2" />
                              Export
                            </DropdownMenuItem>
                            {canDelete && ['DRAFT', 'REJECTED'].includes(timesheet.status) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => onDelete([timesheet.id])}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} timesheets
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

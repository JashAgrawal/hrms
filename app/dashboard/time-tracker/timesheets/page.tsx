'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TimesheetEntryForm } from '@/components/time-tracker/timesheets/timesheet-entry-form'
import { TimesheetList } from '@/components/time-tracker/timesheets/timesheet-list'
import { TimesheetApproval } from '@/components/time-tracker/timesheets/timesheet-approval'
import { Plus, Clock, CheckCircle, XCircle, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Project, Timesheet, TimeEntry } from '@/components/time-tracker/shared/types'
import { TimesheetWithEmployee } from '@/components/time-tracker/shared/prisma-types'

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

export default function TimesheetsPage() {
  const { toast } = useToast()

  // State management
  const [activeTab, setActiveTab] = useState('my-timesheets')
  const [timesheets, setTimesheets] = useState<TimesheetWithEmployee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(20)

  // Modal states
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTimesheet, setEditingTimesheet] = useState<TimesheetWithEmployee | null>(null)
  const [approvingTimesheet, setApprovingTimesheet] = useState<TimesheetWithEmployee | null>(null)
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([])

  // Filters
  const [filters, setFilters] = useState<{
    status?: string
    employeeId?: string
    projectId?: string
  }>({
    status: '',
    employeeId: '',
    projectId: ''
  })
  const [searchQuery, setSearchQuery] = useState('')

  // User permissions (would come from auth context in real app)
  const [userPermissions, setUserPermissions] = useState({
    canApprove: false,
    canEdit: true,
    canDelete: true,
    canViewAll: false
  })

  // Fetch timesheets
  const fetchTimesheets = async () => {
    try {
      setLoading(true)

      // Get date range for current month by default
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const params = new URLSearchParams({
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0],
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.employeeId && { employeeId: filters.employeeId }),
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(searchQuery && { search: searchQuery })
      })

      const res = await fetch(`/api/timesheets?${params}`)
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to fetch timesheets')
      }

      const data = await res.json()
      // Convert string dates to Date objects
      const timesheetsWithDates = (data.timesheets || []).map((timesheet: any) => ({
        ...timesheet,
        createdAt: new Date(timesheet.createdAt),
        updatedAt: new Date(timesheet.updatedAt),
        startDate: new Date(timesheet.startDate),
        endDate: new Date(timesheet.endDate),
        submittedAt: timesheet.submittedAt ? new Date(timesheet.submittedAt) : null,
        approvedAt: timesheet.approvedAt ? new Date(timesheet.approvedAt) : null,
        rejectedAt: timesheet.rejectedAt ? new Date(timesheet.rejectedAt) : null,
      }))
      setTimesheets(timesheetsWithDates)
      setTotalCount(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error fetching timesheets:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load timesheets',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Fetch projects
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects?status=ACTIVE')
      if (!res.ok) throw new Error('Failed to fetch projects')

      const data = await res.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  // Fetch user permissions
  const fetchUserPermissions = async () => {
    try {
      // This would typically come from your auth context or API
      // For now, we'll simulate based on user role
      const res = await fetch('/api/auth/permissions')
      if (res.ok) {
        const data = await res.json()
        setUserPermissions({
          canApprove: data.permissions.includes('TIMESHEET_APPROVE'),
          canEdit: data.permissions.includes('TIMESHEET_EDIT'),
          canDelete: data.permissions.includes('TIMESHEET_DELETE'),
          canViewAll: data.permissions.includes('TIMESHEET_VIEW_ALL')
        })
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
    }
  }

  // Initialize data
  useEffect(() => {
    fetchTimesheets()
    fetchProjects()
    fetchUserPermissions()
  }, [currentPage, filters, searchQuery])

  // Refresh data
  const refreshData = () => {
    fetchTimesheets()
    fetchProjects()
  }

  // Handle timesheet creation/editing
  const handleSaveTimesheet = async (data: any, isDraft: boolean) => {
    try {
      const url = editingTimesheet ? `/api/timesheets/${editingTimesheet.id}` : '/api/timesheets'
      const method = editingTimesheet ? 'PUT' : 'POST'

      const payload = {
        ...data,
        status: isDraft ? 'DRAFT' : 'SUBMITTED'
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save timesheet')
      }

      toast({
        title: 'Success',
        description: `Timesheet ${isDraft ? 'saved as draft' : 'submitted'} successfully`
      })

      setShowCreateForm(false)
      setEditingTimesheet(null)
      refreshData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
      throw error
    }
  }

  // Handle timesheet approval
  const handleApproval = async (data: any) => {
    if (!approvingTimesheet) return

    try {
      const res = await fetch(`/api/timesheets/${approvingTimesheet.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to process approval')
      }

      toast({
        title: 'Success',
        description: `Timesheet ${data.action.toLowerCase()}d successfully`
      })

      setApprovingTimesheet(null)
      refreshData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
      throw error
    }
  }

  // Handle bulk operations
  const handleBulkApprove = async (timesheetIds: string[], action: 'APPROVE' | 'REJECT', comments?: string) => {
    try {
      const res = await fetch('/api/timesheets/bulk?operation=approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheetIds, action, comments })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to process bulk approval')
      }

      const result = await res.json()
      toast({
        title: 'Success',
        description: result.message
      })

      refreshData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleBulkSubmit = async (timesheetIds: string[]) => {
    try {
      const res = await fetch('/api/timesheets/bulk?operation=submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheetIds })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to submit timesheets')
      }

      const result = await res.json()
      toast({
        title: 'Success',
        description: result.message
      })

      refreshData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleBulkDelete = async (timesheetIds: string[]) => {
    try {
      const res = await fetch('/api/timesheets/bulk?operation=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheetIds })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete timesheets')
      }

      const result = await res.json()
      toast({
        title: 'Success',
        description: result.message
      })

      refreshData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleExport = async (timesheetIds: string[]) => {
    try {
      // This would typically generate and download a CSV/Excel file
      const params = new URLSearchParams({ ids: timesheetIds.join(',') })
      const res = await fetch(`/api/timesheets/export?${params}`)

      if (!res.ok) throw new Error('Failed to export timesheets')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `timesheets-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)

      toast({
        title: 'Success',
        description: 'Timesheets exported successfully'
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to export timesheets',
        variant: 'destructive'
      })
    }
  }

  // Fetch approval history
  const fetchApprovalHistory = async (timesheetId: string) => {
    try {
      const res = await fetch(`/api/timesheets/${timesheetId}/approve`)
      if (res.ok) {
        const data = await res.json()
        setApprovalHistory(data.approvalHistory || [])
      }
    } catch (error) {
      console.error('Error fetching approval history:', error)
    }
  }

  // Handle view timesheet
  const handleViewTimesheet = async (timesheet: TimesheetWithEmployee) => {
    await fetchApprovalHistory(timesheet.id)
    setApprovingTimesheet(timesheet)
  }

  // Get summary stats
  const summaryStats = {
    total: timesheets.length,
    draft: timesheets.filter(t => t.status === 'DRAFT').length,
    submitted: timesheets.filter(t => t.status === 'SUBMITTED').length,
    approved: timesheets.filter(t => t.status === 'APPROVED').length,
    rejected: timesheets.filter(t => t.status === 'REJECTED').length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timesheets</h1>
          <p className="text-muted-foreground">
            Track time, manage projects, and submit timesheets for approval
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Timesheet
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total</p>
                <p className="text-2xl font-bold">{summaryStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Draft</p>
                <p className="text-2xl font-bold">{summaryStats.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Submitted</p>
                <p className="text-2xl font-bold">{summaryStats.submitted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Approved</p>
                <p className="text-2xl font-bold">{summaryStats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium">Rejected</p>
                <p className="text-2xl font-bold">{summaryStats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my-timesheets">My Timesheets</TabsTrigger>
          {userPermissions.canViewAll && (
            <TabsTrigger value="all-timesheets">All Timesheets</TabsTrigger>
          )}
          {userPermissions.canApprove && (
            <TabsTrigger value="pending-approval">
              Pending Approval
              {summaryStats.submitted > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {summaryStats.submitted}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-timesheets" className="space-y-4">
          <TimesheetList
            timesheets={timesheets}
            totalCount={totalCount}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onSearch={setSearchQuery}
            onFilter={setFilters}
            onEdit={setEditingTimesheet}
            onView={handleViewTimesheet}
            onDelete={handleBulkDelete}
            onBulkApprove={handleBulkApprove}
            onBulkSubmit={handleBulkSubmit}
            onExport={handleExport}
            canApprove={false}
            canEdit={userPermissions.canEdit}
            canDelete={userPermissions.canDelete}
            isLoading={loading}
          />
        </TabsContent>

        <TabsContent value="all-timesheets" className="space-y-4">
          <TimesheetList
            timesheets={timesheets}
            totalCount={totalCount}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onSearch={setSearchQuery}
            onFilter={setFilters}
            onEdit={setEditingTimesheet}
            onView={handleViewTimesheet}
            onDelete={handleBulkDelete}
            onBulkApprove={handleBulkApprove}
            onBulkSubmit={handleBulkSubmit}
            onExport={handleExport}
            canApprove={userPermissions.canApprove}
            canEdit={userPermissions.canEdit}
            canDelete={userPermissions.canDelete}
            isLoading={loading}
          />
        </TabsContent>

        <TabsContent value="pending-approval" className="space-y-4">
          <TimesheetList
            timesheets={timesheets.filter(t => t.status === 'SUBMITTED')}
            totalCount={summaryStats.submitted}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onSearch={setSearchQuery}
            onFilter={setFilters}
            onEdit={() => {}} // No editing in approval view
            onView={handleViewTimesheet}
            onDelete={() => {}} // No deletion in approval view
            onBulkApprove={handleBulkApprove}
            onBulkSubmit={() => {}} // No submission in approval view
            onExport={handleExport}
            canApprove={userPermissions.canApprove}
            canEdit={false}
            canDelete={false}
            isLoading={loading}
          />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Timesheet Modal */}
      {(showCreateForm || editingTimesheet) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <TimesheetEntryForm
              initialData={editingTimesheet ? {
                id: editingTimesheet.id,
                startDate: editingTimesheet.startDate.toISOString().split('T')[0],
                endDate: editingTimesheet.endDate.toISOString().split('T')[0],
                entries: editingTimesheet.entries.map(entry => ({
                  date: entry.date instanceof Date ? entry.date.toISOString().split('T')[0] : entry.date,
                  startTime: entry.startTime || '09:00',
                  endTime: entry.endTime || '17:00',
                  breakDuration: entry.breakDuration,
                  projectId: entry.project?.id || '',
                  taskDescription: entry.taskDescription || '',
                  billableHours: Number(entry.billableHours),
                  nonBillableHours: Number(entry.nonBillableHours),
                  overtimeHours: Number(entry.overtimeHours),
                })),
                status: editingTimesheet.status
              } : undefined}
              projects={projects}
              onSave={handleSaveTimesheet}
              onCancel={() => {
                setShowCreateForm(false)
                setEditingTimesheet(null)
              }}
              readonly={editingTimesheet?.status === 'APPROVED'}
            />
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvingTimesheet && (
        <TimesheetApproval
          timesheet={approvingTimesheet}
          approvalHistory={approvalHistory}
          canApprove={userPermissions.canApprove && approvingTimesheet.status === 'SUBMITTED'}
          onApprove={handleApproval}
          onClose={() => setApprovingTimesheet(null)}
        />
      )}
    </div>
  )
}



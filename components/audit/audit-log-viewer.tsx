'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Search, Filter, Download, Printer, RefreshCw, Eye, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuditLogFilters, PaginatedAuditLogs } from '@/lib/audit-service'

interface AuditLog {
  id: string
  timestamp: Date
  userId?: string | null
  userName?: string | null
  action: string
  resource: string
  resourceId?: string | null
  details?: any
  oldValues?: any
  newValues?: any
  ipAddress?: string | null
  userAgent?: string | null
  success: boolean
  errorMessage?: string | null
  user?: {
    id: string
    name: string
    email: string
  }
}

interface AuditLogViewerProps {
  className?: string
}

export function AuditLogViewer({ className }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 50,
  })
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  })
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('')
  const [resourceFilter, setResourceFilter] = useState<string>('')
  const [successFilter, setSuccessFilter] = useState<string>('')
  const [userFilter, setUserFilter] = useState<string>('')

  // Fetch audit logs
  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)

      const queryParams = new URLSearchParams()
      if (filters.page) queryParams.set('page', filters.page.toString())
      if (filters.limit) queryParams.set('limit', filters.limit.toString())
      if (filters.search) queryParams.set('search', filters.search)
      if (filters.action) queryParams.set('action', filters.action)
      if (filters.resource) queryParams.set('resource', filters.resource)
      if (filters.userId) queryParams.set('userId', filters.userId)
      if (typeof filters.success === 'boolean') queryParams.set('success', filters.success.toString())
      if (filters.startDate) queryParams.set('startDate', filters.startDate.toISOString())
      if (filters.endDate) queryParams.set('endDate', filters.endDate.toISOString())

      const response = await fetch(`/api/audit-logs?${queryParams}`)
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs')
      }

      const data: PaginatedAuditLogs = await response.json()
      setLogs(data.logs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp),
      })))
      setPagination({
        total: data.total,
        page: data.page,
        limit: data.limit,
        totalPages: data.totalPages,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Apply filters
  const applyFilters = () => {
    const newFilters: AuditLogFilters = {
      page: 1,
      limit: 50,
      search: searchTerm || undefined,
      action: actionFilter || undefined,
      resource: resourceFilter || undefined,
      userId: userFilter || undefined,
      success: successFilter === 'true' ? true : successFilter === 'false' ? false : undefined,
    }
    setFilters(newFilters)
  }

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('')
    setActionFilter('')
    setResourceFilter('')
    setSuccessFilter('')
    setUserFilter('')
    setFilters({ page: 1, limit: 50 })
  }

  // Export logs
  const exportLogs = async (exportFormat: 'csv' | 'pdf') => {
    try {
      const queryParams = new URLSearchParams()
      if (filters.search) queryParams.set('search', filters.search)
      if (filters.action) queryParams.set('action', filters.action)
      if (filters.resource) queryParams.set('resource', filters.resource)
      if (filters.userId) queryParams.set('userId', filters.userId)
      if (typeof filters.success === 'boolean') queryParams.set('success', filters.success.toString())
      if (filters.startDate) queryParams.set('startDate', filters.startDate.toISOString())
      if (filters.endDate) queryParams.set('endDate', filters.endDate.toISOString())
      queryParams.set('format', exportFormat)

      const response = await fetch(`/api/audit-logs/export?${queryParams}`)
      if (!response.ok) {
        throw new Error('Failed to export audit logs')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${exportFormat}-${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  // Print logs
  const printLogs = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const printContent = `
      <html>
        <head>
          <title>Audit Logs Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { margin-bottom: 20px; }
            .success { color: green; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Audit Logs Report</h1>
            <p>Generated on: ${format(new Date(), 'PPP')}</p>
            <p>Total Records: ${pagination.total}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Status</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td>${format(log.timestamp, 'PPp')}</td>
                  <td>${log.userName || log.user?.name || 'Unknown'}</td>
                  <td>${log.action}</td>
                  <td>${log.resource}${log.resourceId ? ` (${log.resourceId})` : ''}</td>
                  <td class="${log.success ? 'success' : 'error'}">${log.success ? 'Success' : 'Failed'}</td>
                  <td>${log.ipAddress || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.print()
  }

  // Pagination handlers
  const goToPage = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
  }

  useEffect(() => {
    fetchLogs()
  }, [filters])

  const getStatusBadge = (success: boolean) => {
    return success ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Success
      </Badge>
    ) : (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Failed
      </Badge>
    )
  }

  const getActionBadge = (action: string) => {
    const colorMap: Record<string, string> = {
      CREATE: 'bg-blue-100 text-blue-800',
      READ: 'bg-gray-100 text-gray-800',
      UPDATE: 'bg-yellow-100 text-yellow-800',
      DELETE: 'bg-red-100 text-red-800',
      LOGIN: 'bg-green-100 text-green-800',
      LOGOUT: 'bg-orange-100 text-orange-800',
      APPROVE: 'bg-purple-100 text-purple-800',
      REJECT: 'bg-pink-100 text-pink-800',
    }

    return (
      <Badge variant="secondary" className={colorMap[action] || 'bg-gray-100 text-gray-800'}>
        {action}
      </Badge>
    )
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Audit Logs
          </CardTitle>
          <CardDescription>
            View and analyze system audit logs for security and compliance tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="READ">Read</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="LOGOUT">Logout</SelectItem>
                  <SelectItem value="APPROVE">Approve</SelectItem>
                  <SelectItem value="REJECT">Reject</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Resource" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Resources</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="ATTENDANCE">Attendance</SelectItem>
                  <SelectItem value="LEAVE_REQUEST">Leave Request</SelectItem>
                  <SelectItem value="PAYROLL_RUN">Payroll Run</SelectItem>
                  <SelectItem value="PAYSLIP">Payslip</SelectItem>
                </SelectContent>
              </Select>
              <Select value={successFilter} onValueChange={setSuccessFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="true">Success</SelectItem>
                  <SelectItem value="false">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={applyFilters} size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Apply Filters
              </Button>
              <Button onClick={clearFilters} variant="outline" size="sm">
                Clear
              </Button>
              <Button onClick={() => fetchLogs()} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Separator orientation="vertical" className="h-8" />
              <Button onClick={() => exportLogs('csv')} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={printLogs} variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Loading audit logs...
            </div>
          )}

          {/* Audit Logs Table */}
          {!loading && (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {format(log.timestamp, 'MMM dd, yyyy HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {log.userName || log.user?.name || 'Unknown'}
                              </div>
                              {log.user?.email && (
                                <div className="text-sm text-muted-foreground">
                                  {log.user.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getActionBadge(log.action)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.resource}</div>
                              {log.resourceId && (
                                <div className="text-sm text-muted-foreground font-mono">
                                  {log.resourceId}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(log.success)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.ipAddress || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedLog(log)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Audit Log Details</DialogTitle>
                                  <DialogDescription>
                                    Detailed information about this audit log entry
                                  </DialogDescription>
                                </DialogHeader>
                                {selectedLog && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">Timestamp</label>
                                        <p className="font-mono text-sm">
                                          {format(selectedLog.timestamp, 'PPp')}
                                        </p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">User</label>
                                        <p>{selectedLog.userName || selectedLog.user?.name || 'Unknown'}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Action</label>
                                        <p>{getActionBadge(selectedLog.action)}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Resource</label>
                                        <p>{selectedLog.resource}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Resource ID</label>
                                        <p className="font-mono text-sm">{selectedLog.resourceId || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Status</label>
                                        <p>{getStatusBadge(selectedLog.success)}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">IP Address</label>
                                        <p className="font-mono text-sm">{selectedLog.ipAddress || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">User Agent</label>
                                        <p className="text-sm break-all">{selectedLog.userAgent || 'N/A'}</p>
                                      </div>
                                    </div>
                                    
                                    {selectedLog.errorMessage && (
                                      <div>
                                        <label className="text-sm font-medium text-red-600">Error Message</label>
                                        <p className="text-red-600 text-sm">{selectedLog.errorMessage}</p>
                                      </div>
                                    )}

                                    {selectedLog.details && (
                                      <div>
                                        <label className="text-sm font-medium">Details</label>
                                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                          {JSON.stringify(selectedLog.details, null, 2)}
                                        </pre>
                                      </div>
                                    )}

                                    {selectedLog.oldValues && (
                                      <div>
                                        <label className="text-sm font-medium">Old Values</label>
                                        <pre className="bg-red-50 p-3 rounded text-xs overflow-x-auto">
                                          {JSON.stringify(selectedLog.oldValues, null, 2)}
                                        </pre>
                                      </div>
                                    )}

                                    {selectedLog.newValues && (
                                      <div>
                                        <label className="text-sm font-medium">New Values</label>
                                        <pre className="bg-green-50 p-3 rounded text-xs overflow-x-auto">
                                          {JSON.stringify(selectedLog.newValues, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const page = i + Math.max(1, pagination.page - 2)
                      if (page > pagination.totalPages) return null
                      return (
                        <Button
                          key={page}
                          variant={page === pagination.page ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(page)}
                        >
                          {page}
                        </Button>
                      )
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
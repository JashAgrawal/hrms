'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { 
  Shield, 
  Search, 
  Filter, 
  Download, 
  Eye,
  Calendar,
  User,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateRange } from 'react-day-picker'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'

interface AuditLog {
  id: string
  timestamp: string
  action: string
  resource: string
  resourceId?: string
  user: {
    id: string
    name: string
    email: string
    role: string
    employeeCode?: string
    employeeName?: string
  } | null
  oldValues?: any
  newValues?: any
  ipAddress?: string
  userAgent?: string
}

interface AuditLogResponse {
  logs: AuditLog[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  })
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  useEffect(() => {
    fetchAuditLogs()
  }, [pagination.page, actionFilter, resourceFilter, userFilter, dateRange])

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (actionFilter) params.append('action', actionFilter)
      if (resourceFilter) params.append('resource', resourceFilter)
      if (userFilter) params.append('userId', userFilter)
      if (dateRange?.from) params.append('startDate', dateRange.from.toISOString())
      if (dateRange?.to) params.append('endDate', dateRange.to.toISOString())

      const response = await fetch(`/api/audit-logs?${params}`)
      
      if (response.ok) {
        const data: AuditLogResponse = await response.json()
        setLogs(data.logs)
        setPagination(data.pagination)
      } else {
        throw new Error('Failed to fetch audit logs')
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchAuditLogs()
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-800'
    if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-800'
    if (action.includes('DELETE')) return 'bg-red-100 text-red-800'
    if (action.includes('APPROVE')) return 'bg-emerald-100 text-emerald-800'
    if (action.includes('REJECT')) return 'bg-orange-100 text-orange-800'
    if (action.includes('LOGIN')) return 'bg-purple-100 text-purple-800'
    if (action.includes('VIEW')) return 'bg-gray-100 text-gray-800'
    return 'bg-gray-100 text-gray-800'
  }

  const formatUserInfo = (user: AuditLog['user']) => {
    if (!user) return 'System'
    return user.employeeName || user.name || user.email
  }

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      log.action.toLowerCase().includes(searchLower) ||
      log.resource.toLowerCase().includes(searchLower) ||
      formatUserInfo(log.user).toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground">
            Monitor system activity and security events
          </p>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="APPROVE">Approve</SelectItem>
                  <SelectItem value="REJECT">Reject</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="VIEW">View</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Resource</label>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All resources</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="LEAVE_REQUEST">Leave Request</SelectItem>
                  <SelectItem value="ATTENDANCE">Attendance</SelectItem>
                  <SelectItem value="PAYROLL">Payroll</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="LOCATION">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Activity ({pagination.totalCount} total)
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <Badge className={getActionBadgeColor(log.action)}>
                        {log.action}
                      </Badge>
                      <span className="font-medium">{log.resource}</span>
                      {log.resourceId && (
                        <span className="text-sm text-gray-500">
                          ID: {log.resourceId.slice(-8)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {formatUserInfo(log.user)}
                        {log.user?.role && (
                          <Badge variant="outline" className="text-xs">
                            {log.user.role}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </div>
                      
                      {log.ipAddress && (
                        <div className="text-xs text-gray-500">
                          IP: {log.ipAddress}
                        </div>
                      )}
                    </div>

                    {log.newValues && Object.keys(log.newValues).length > 0 && (
                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2">
                        <strong>Details:</strong> {JSON.stringify(log.newValues, null, 2).slice(0, 200)}
                        {JSON.stringify(log.newValues).length > 200 && '...'}
                      </div>
                    )}
                  </div>
                  
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {filteredLogs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No audit logs found matching your criteria</p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
                {pagination.totalCount} results
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, pagination.page - 2) + i
                    if (pageNum > pagination.totalPages) return null
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
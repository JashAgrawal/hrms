'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  DollarSign,
  Download,
  Filter,
  Search,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'

interface AuditTrailEntry {
  id: string
  timestamp: Date
  action: string
  resource: string
  resourceId: string
  userId: string
  userName: string
  userRole: string
  details: any
  ipAddress?: string
  userAgent?: string
  success: boolean
  errorMessage?: string
}

interface ComplianceMetrics {
  totalClaims: number
  compliantClaims: number
  violationClaims: number
  complianceScore: number
  policyViolations: Array<{
    rule: string
    count: number
    totalAmount: number
  }>
  receiptCompliance: {
    required: number
    provided: number
    rate: number
  }
  approvalCompliance: {
    required: number
    completed: number
    rate: number
  }
}

interface ExpenseAuditTrailProps {
  expenseId?: string
  showFilters?: boolean
}

export function ExpenseAuditTrail({ expenseId, showFilters = true }: ExpenseAuditTrailProps) {
  const [auditEntries, setAuditEntries] = useState<AuditTrailEntry[]>([])
  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('audit-trail')
  
  // Filters
  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    dateRange: null as any,
    resource: '',
    success: ''
  })

  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchAuditTrail()
    if (!expenseId) {
      fetchComplianceMetrics()
    }
  }, [expenseId, filters])

  const fetchAuditTrail = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      if (expenseId) {
        params.append('resourceId', expenseId)
      }
      
      if (filters.action) {
        params.append('action', filters.action)
      }
      
      if (filters.userId) {
        params.append('userId', filters.userId)
      }
      
      if (filters.resource) {
        params.append('resource', filters.resource)
      }
      
      if (filters.success) {
        params.append('success', filters.success)
      }
      
      if (filters.dateRange?.from) {
        params.append('startDate', format(filters.dateRange.from, 'yyyy-MM-dd'))
      }
      
      if (filters.dateRange?.to) {
        params.append('endDate', format(filters.dateRange.to, 'yyyy-MM-dd'))
      }

      const response = await fetch(`/api/expenses/audit-trail?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAuditEntries(data.entries || [])
      }
    } catch (error) {
      console.error('Error fetching audit trail:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComplianceMetrics = async () => {
    try {
      const params = new URLSearchParams()
      
      if (filters.dateRange?.from) {
        params.append('startDate', format(filters.dateRange.from, 'yyyy-MM-dd'))
      }
      
      if (filters.dateRange?.to) {
        params.append('endDate', format(filters.dateRange.to, 'yyyy-MM-dd'))
      }

      const response = await fetch(`/api/expenses/compliance?${params}`)
      if (response.ok) {
        const data = await response.json()
        setComplianceMetrics(data)
      }
    } catch (error) {
      console.error('Error fetching compliance metrics:', error)
    }
  }

  const exportAuditTrail = async () => {
    try {
      const params = new URLSearchParams()
      params.append('format', 'csv')
      
      if (expenseId) {
        params.append('resourceId', expenseId)
      }

      const response = await fetch(`/api/expenses/audit-trail/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `expense-audit-trail-${format(new Date(), 'yyyy-MM-dd')}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting audit trail:', error)
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'EXPENSE_CREATED':
        return <FileText className="h-4 w-4 text-blue-600" />
      case 'EXPENSE_APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'EXPENSE_REJECTED':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'EXPENSE_REIMBURSED':
        return <DollarSign className="h-4 w-4 text-purple-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getActionBadge = (action: string, success: boolean) => {
    if (!success) {
      return <Badge variant="destructive">Failed</Badge>
    }

    switch (action) {
      case 'EXPENSE_CREATED':
        return <Badge variant="secondary">Created</Badge>
      case 'EXPENSE_APPROVED':
        return <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>
      case 'EXPENSE_REJECTED':
        return <Badge variant="destructive">Rejected</Badge>
      case 'EXPENSE_REIMBURSED':
        return <Badge variant="default" className="bg-purple-100 text-purple-800">Reimbursed</Badge>
      default:
        return <Badge variant="outline">{action.replace('EXPENSE_', '').replace('_', ' ')}</Badge>
    }
  }

  const filteredEntries = auditEntries.filter(entry => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        entry.action.toLowerCase().includes(searchLower) ||
        entry.userName.toLowerCase().includes(searchLower) ||
        entry.resourceId.toLowerCase().includes(searchLower) ||
        JSON.stringify(entry.details).toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {expenseId ? 'Expense Audit Trail' : 'Expense Compliance & Audit'}
          </h2>
          <p className="text-muted-foreground">
            {expenseId 
              ? 'Complete audit trail for this expense claim'
              : 'Comprehensive audit trail and compliance monitoring for expense management'
            }
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportAuditTrail}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Compliance Metrics (only show if not viewing specific expense) */}
      {!expenseId && complianceMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Compliance Score</p>
                  <p className="text-2xl font-bold">{complianceMetrics.complianceScore}%</p>
                  <p className="text-xs text-muted-foreground">
                    {complianceMetrics.compliantClaims}/{complianceMetrics.totalClaims} compliant
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Receipt Compliance</p>
                  <p className="text-2xl font-bold">{complianceMetrics.receiptCompliance.rate}%</p>
                  <p className="text-xs text-muted-foreground">
                    {complianceMetrics.receiptCompliance.provided}/{complianceMetrics.receiptCompliance.required} provided
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Approval Compliance</p>
                  <p className="text-2xl font-bold">{complianceMetrics.approvalCompliance.rate}%</p>
                  <p className="text-xs text-muted-foreground">
                    {complianceMetrics.approvalCompliance.completed}/{complianceMetrics.approvalCompliance.required} completed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Policy Violations</p>
                  <p className="text-2xl font-bold">{complianceMetrics.violationClaims}</p>
                  <p className="text-xs text-muted-foreground">
                    {complianceMetrics.policyViolations.length} violation types
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="audit-trail">Audit Trail</TabsTrigger>
          {!expenseId && <TabsTrigger value="compliance">Compliance Report</TabsTrigger>}
          {!expenseId && <TabsTrigger value="violations">Policy Violations</TabsTrigger>}
        </TabsList>

        <TabsContent value="audit-trail" className="space-y-4">
          {/* Filters */}
          {showFilters && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Filter className="h-5 w-5 mr-2" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search audit entries..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Action</label>
                    <Select value={filters.action} onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All actions</SelectItem>
                        <SelectItem value="EXPENSE_CREATED">Created</SelectItem>
                        <SelectItem value="EXPENSE_APPROVED">Approved</SelectItem>
                        <SelectItem value="EXPENSE_REJECTED">Rejected</SelectItem>
                        <SelectItem value="EXPENSE_REIMBURSED">Reimbursed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select value={filters.success} onValueChange={(value) => setFilters(prev => ({ ...prev, success: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="true">Success</SelectItem>
                        <SelectItem value="false">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Date Range</label>
                    <DatePickerWithRange
                      date={filters.dateRange}
                      onDateChange={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit Trail Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Audit Trail ({filteredEntries.length} entries)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {format(new Date(entry.timestamp), 'MMM dd, yyyy')}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(entry.timestamp), 'HH:mm:ss')}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getActionIcon(entry.action)}
                            <span className="font-medium">{entry.action.replace('EXPENSE_', '').replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{entry.userName}</div>
                              <div className="text-sm text-muted-foreground">{entry.userRole}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.resource}</div>
                            <div className="text-sm text-muted-foreground">{entry.resourceId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getActionBadge(entry.action, entry.success)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {!expenseId && (
          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Overview</CardTitle>
                <CardDescription>
                  Detailed compliance metrics and policy adherence
                </CardDescription>
              </CardHeader>
              <CardContent>
                {complianceMetrics && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-3xl font-bold text-green-600">
                          {complianceMetrics.complianceScore}%
                        </div>
                        <div className="text-sm text-muted-foreground">Overall Compliance</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-3xl font-bold text-blue-600">
                          {complianceMetrics.receiptCompliance.rate}%
                        </div>
                        <div className="text-sm text-muted-foreground">Receipt Compliance</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-3xl font-bold text-purple-600">
                          {complianceMetrics.approvalCompliance.rate}%
                        </div>
                        <div className="text-sm text-muted-foreground">Approval Compliance</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {!expenseId && (
          <TabsContent value="violations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Policy Violations</CardTitle>
                <CardDescription>
                  Analysis of policy violations and non-compliance issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                {complianceMetrics && (
                  <div className="space-y-4">
                    {complianceMetrics.policyViolations.map((violation, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          <div>
                            <div className="font-medium">{violation.rule.replace('_', ' ')}</div>
                            <div className="text-sm text-muted-foreground">
                              {violation.count} violations • ₹{violation.totalAmount.toLocaleString()} total amount
                            </div>
                          </div>
                        </div>
                        <Badge variant="destructive">{violation.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
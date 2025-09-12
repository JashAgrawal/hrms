'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Download, 
  MoreHorizontal,
  Calendar,
  MapPin,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ExpenseClaim {
  id: string
  title: string
  description?: string
  amount: number
  expenseDate: Date
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'CANCELLED'
  merchantName?: string
  billNumber?: string
  location?: {
    latitude: number
    longitude: number
    address?: string
  }
  category: {
    id: string
    name: string
    code: string
    maxAmount?: number
    requiresReceipt: boolean
    requiresApproval: boolean
  }
  employee?: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    email: string
  }
  attachments: Array<{
    id: string
    fileName: string
    fileType: string
    fileSize: number
    fileUrl?: string
  }>
  approvals: Array<{
    id: string
    level: number
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    approverName: string
    approvedAt?: Date
    comments?: string
  }>
  createdAt: Date
  updatedAt: Date
}

interface ExpenseCategory {
  id: string
  name: string
  code: string
  isActive: boolean
}

interface ExpenseClaimListProps {
  onCreateNew: () => void
  onEdit: (claim: ExpenseClaim) => void
  onView: (claim: ExpenseClaim) => void
  onDelete: (claimId: string) => void
}

const statusConfig = {
  PENDING: {
    label: 'Pending',
    variant: 'secondary' as const,
    icon: Clock,
    color: 'text-yellow-600'
  },
  APPROVED: {
    label: 'Approved',
    variant: 'default' as const,
    icon: CheckCircle,
    color: 'text-green-600'
  },
  REJECTED: {
    label: 'Rejected',
    variant: 'destructive' as const,
    icon: XCircle,
    color: 'text-red-600'
  },
  REIMBURSED: {
    label: 'Reimbursed',
    variant: 'default' as const,
    icon: DollarSign,
    color: 'text-blue-600'
  },
  CANCELLED: {
    label: 'Cancelled',
    variant: 'outline' as const,
    icon: AlertCircle,
    color: 'text-gray-600'
  }
}

export function ExpenseClaimList({ onCreateNew, onEdit, onView, onDelete }: ExpenseClaimListProps) {
  const [claims, setClaims] = useState<ExpenseClaim[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null)

  // Fetch expense claims
  const fetchClaims = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
      })

      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (categoryFilter !== 'all') params.append('categoryId', categoryFilter)
      if (dateRange.start) params.append('startDate', dateRange.start)
      if (dateRange.end) params.append('endDate', dateRange.end)

      const response = await fetch(`/api/expenses?${params}`)
      if (response.ok) {
        const data = await response.json()
        setClaims(data.data || [])
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('Error fetching expense claims:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/expenses/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.filter((cat: ExpenseCategory) => cat.isActive))
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchClaims()
  }, [currentPage, statusFilter, categoryFilter, dateRange])

  // Filter claims based on search term
  const filteredClaims = claims.filter(claim =>
    claim.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.merchantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.billNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle delete
  const handleDelete = async (claimId: string) => {
    if (!confirm('Are you sure you want to delete this expense claim?')) return

    try {
      const response = await fetch(`/api/expenses/${claimId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchClaims()
        onDelete(claimId)
      } else {
        alert('Failed to delete expense claim')
      }
    } catch (error) {
      console.error('Error deleting expense claim:', error)
      alert('Error deleting expense claim')
    }
  }

  // Get status icon and color
  const getStatusDisplay = (status: ExpenseClaim['status']) => {
    const config = statusConfig[status]
    const Icon = config.icon
    return (
      <div className="flex items-center space-x-2">
        <Icon className={cn("h-4 w-4", config.color)} />
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>
    )
  }

  // Get approval progress
  const getApprovalProgress = (approvals: ExpenseClaim['approvals']) => {
    if (approvals.length === 0) return null

    const approved = approvals.filter(a => a.status === 'APPROVED').length
    const total = approvals.length

    return (
      <div className="flex items-center space-x-2">
        <div className="text-sm text-muted-foreground">
          {approved}/{total} approvals
        </div>
        <div className="w-16 bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${(approved / total) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Claims</h1>
          <p className="text-muted-foreground">
            Manage and track your expense claims and reimbursements
          </p>
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Expense Claim
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search claims..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="REIMBURSED">Reimbursed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <div className="flex space-x-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="text-sm"
                />
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Claims</CardTitle>
          <CardDescription>
            {filteredClaims.length} claim(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No expense claims found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval Progress</TableHead>
                    <TableHead>Attachments</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{claim.title}</p>
                          {claim.merchantName && (
                            <p className="text-sm text-muted-foreground">
                              {claim.merchantName}
                            </p>
                          )}
                          {claim.location && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 mr-1" />
                              Location captured
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{claim.category.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          ₹{claim.amount.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          {format(new Date(claim.expenseDate), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusDisplay(claim.status)}
                      </TableCell>
                      <TableCell>
                        {getApprovalProgress(claim.approvals)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{claim.attachments.length}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(claim)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {claim.status === 'PENDING' && (
                              <DropdownMenuItem onClick={() => onEdit(claim)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Download Receipt
                            </DropdownMenuItem>
                            {claim.status === 'PENDING' && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(claim.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
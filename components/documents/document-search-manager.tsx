'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  Search, 
  Filter, 
  Tag, 
  FileText, 
  Download, 
  Eye, 
  Calendar,
  User,
  FolderOpen,
  SortAsc,
  SortDesc,
  Grid,
  List,
  Archive,
  AlertTriangle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface Document {
  id: string
  title: string
  description?: string
  category: string
  fileName: string
  originalName?: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
  version: number
  status: string
  isRequired: boolean
  expiryDate?: string
  tags?: string[]
  uploadedBy: string
  approvalStatus: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  employee?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  accessLogs?: DocumentAccessLog[]
}

interface DocumentAccessLog {
  id: string
  userId?: string
  userName?: string
  action: string
  timestamp: string
  ipAddress?: string
  success: boolean
}

interface DocumentSearchManagerProps {
  documents?: Document[]
  onDocumentSelect?: (document: Document) => void
  showEmployeeFilter?: boolean
}

export function DocumentSearchManager({ 
  documents: initialDocuments = [],
  onDocumentSelect,
  showEmployeeFilter = true
}: DocumentSearchManagerProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState('all')
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [showExpiredOnly, setShowExpiredOnly] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [accessLogsDialog, setAccessLogsDialog] = useState(false)
  const { toast } = useToast()

  // Extract unique values for filters
  const categories = useMemo(() => {
    const cats = [...new Set(documents.map(doc => doc.category))]
    return cats.sort()
  }, [documents])

  const employees = useMemo(() => {
    const emps = documents
      .filter(doc => doc.employee)
      .map(doc => doc.employee!)
      .filter((emp, index, self) => self.findIndex(e => e.id === emp.id) === index)
    return emps.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
  }, [documents])

  const allTags = useMemo(() => {
    const tags = documents
      .flatMap(doc => doc.tags || [])
      .filter((tag, index, self) => self.indexOf(tag) === index)
    return tags.sort()
  }, [documents])

  // Filter and search documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents.filter(doc => {
      // Text search
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesTitle = doc.title.toLowerCase().includes(searchLower)
        const matchesDescription = doc.description?.toLowerCase().includes(searchLower)
        const matchesFileName = doc.fileName.toLowerCase().includes(searchLower)
        const matchesOriginalName = doc.originalName?.toLowerCase().includes(searchLower)
        const matchesTags = doc.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        
        if (!matchesTitle && !matchesDescription && !matchesFileName && !matchesOriginalName && !matchesTags) {
          return false
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
        return false
      }

      // Status filter
      if (selectedStatus !== 'all' && doc.status !== selectedStatus) {
        return false
      }

      // Approval status filter
      if (selectedApprovalStatus !== 'all' && doc.approvalStatus !== selectedApprovalStatus) {
        return false
      }

      // Employee filter
      if (selectedEmployee !== 'all' && doc.employee?.id !== selectedEmployee) {
        return false
      }

      // Date range filter
      if (dateRange.from && new Date(doc.createdAt) < new Date(dateRange.from)) {
        return false
      }
      if (dateRange.to && new Date(doc.createdAt) > new Date(dateRange.to)) {
        return false
      }

      // Tags filter
      if (selectedTags.length > 0) {
        const docTags = doc.tags || []
        if (!selectedTags.some(tag => docTags.includes(tag))) {
          return false
        }
      }

      // Expired only filter
      if (showExpiredOnly) {
        if (!doc.expiryDate || new Date(doc.expiryDate) >= new Date()) {
          return false
        }
      }

      return true
    })

    // Sort documents
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof Document]
      let bValue: any = b[sortBy as keyof Document]

      // Handle nested properties
      if (sortBy === 'employeeName') {
        aValue = a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : ''
        bValue = b.employee ? `${b.employee.firstName} ${b.employee.lastName}` : ''
      }

      // Handle dates
      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'expiryDate') {
        aValue = aValue ? new Date(aValue).getTime() : 0
        bValue = bValue ? new Date(bValue).getTime() : 0
      }

      // Handle strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      // Handle numbers
      if (sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    return filtered
  }, [
    documents, 
    searchTerm, 
    selectedCategory, 
    selectedStatus, 
    selectedApprovalStatus,
    selectedEmployee,
    dateRange, 
    selectedTags, 
    sortBy, 
    sortOrder,
    showExpiredOnly
  ])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/documents')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAccessLogs = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/access-logs`)
      if (response.ok) {
        const data = await response.json()
        setSelectedDocument(prev => prev ? { ...prev, accessLogs: data.logs } : null)
      }
    } catch (error) {
      console.error('Error fetching access logs:', error)
    }
  }

  useEffect(() => {
    if (!initialDocuments.length) {
      fetchDocuments()
    }
  }, [])

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('all')
    setSelectedStatus('all')
    setSelectedApprovalStatus('all')
    setSelectedEmployee('all')
    setDateRange({ from: '', to: '' })
    setSelectedTags([])
    setShowExpiredOnly(false)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PENDING: 'outline',
      APPROVED: 'default',
      REJECTED: 'destructive',
      ACTIVE: 'default',
      EXPIRED: 'destructive',
      ARCHIVED: 'secondary'
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleDocumentClick = (document: Document) => {
    setSelectedDocument(document)
    onDocumentSelect?.(document)
  }

  const handleViewAccessLogs = (document: Document) => {
    setSelectedDocument(document)
    fetchAccessLogs(document.id)
    setAccessLogsDialog(true)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Document Search & Organization
          </CardTitle>
          <CardDescription>
            Search, filter, and organize documents with advanced criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label>Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="DELETED">Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Approval Status</Label>
                <Select value={selectedApprovalStatus} onValueChange={setSelectedApprovalStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Approvals</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Additional Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {showEmployeeFilter && (
                <div>
                  <Label>Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {employees.map(employee => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="dateFrom">Date From</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="dateTo">Date To</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                />
              </div>
            </div>

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {allTags.map(tag => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleTagToggle(tag)}
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Options */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="expiredOnly"
                    checked={showExpiredOnly}
                    onCheckedChange={(checked) => setShowExpiredOnly(checked === true)}
                  />
                  <Label htmlFor="expiredOnly">Show expired only</Label>
                </div>
                
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="createdAt">Created Date</SelectItem>
                    <SelectItem value="updatedAt">Updated Date</SelectItem>
                    <SelectItem value="expiryDate">Expiry Date</SelectItem>
                    <SelectItem value="version">Version</SelectItem>
                    <SelectItem value="fileSize">File Size</SelectItem>
                    {showEmployeeFilter && <SelectItem value="employeeName">Employee</SelectItem>}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(prev => prev === 'list' ? 'grid' : 'list')}
                >
                  {viewMode === 'list' ? <Grid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredDocuments.length} of {documents.length} documents
            </div>

            {/* Document List/Grid */}
            {viewMode === 'list' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval</TableHead>
                    {showEmployeeFilter && <TableHead>Employee</TableHead>}
                    <TableHead>Created</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((document) => (
                    <TableRow 
                      key={document.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleDocumentClick(document)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{document.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatFileSize(document.fileSize)} • {document.mimeType}
                          </div>
                          {document.tags && document.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {document.tags.slice(0, 3).map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {document.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{document.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{document.category}</Badge>
                      </TableCell>
                      <TableCell>v{document.version}</TableCell>
                      <TableCell>{getStatusBadge(document.status)}</TableCell>
                      <TableCell>{getStatusBadge(document.approvalStatus)}</TableCell>
                      {showEmployeeFilter && (
                        <TableCell>
                          {document.employee ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {document.employee.firstName} {document.employee.lastName}
                            </div>
                          ) : (
                            'System'
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {format(new Date(document.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {document.expiryDate ? (
                          <div className="flex items-center gap-1">
                            {new Date(document.expiryDate) < new Date() ? (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Calendar className="h-4 w-4 text-blue-500" />
                            )}
                            {format(new Date(document.expiryDate), 'MMM dd, yyyy')}
                          </div>
                        ) : (
                          'No expiry'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(document.fileUrl, '_blank')
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              const link = window.document.createElement('a')
                              link.href = document.fileUrl
                              link.download = document.originalName || document.fileName
                              link.click()
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewAccessLogs(document)
                            }}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDocuments.map((document) => (
                  <Card 
                    key={document.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleDocumentClick(document)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div className="flex gap-1">
                          {getStatusBadge(document.status)}
                        </div>
                      </div>
                      <CardTitle className="text-sm line-clamp-2">{document.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {document.category} • v{document.version}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div>{formatFileSize(document.fileSize)}</div>
                        <div>Created: {format(new Date(document.createdAt), 'MMM dd, yyyy')}</div>
                        {document.expiryDate && (
                          <div className="flex items-center gap-1">
                            {new Date(document.expiryDate) < new Date() ? (
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            ) : (
                              <Calendar className="h-3 w-3 text-blue-500" />
                            )}
                            Expires: {format(new Date(document.expiryDate), 'MMM dd, yyyy')}
                          </div>
                        )}
                        {document.tags && document.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {document.tags.slice(0, 2).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {filteredDocuments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No documents found matching your criteria
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Access Logs Dialog */}
      <Dialog open={accessLogsDialog} onOpenChange={setAccessLogsDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Document Access Logs</DialogTitle>
            <DialogDescription>
              View access history for "{selectedDocument?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDocument?.accessLogs && selectedDocument.accessLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDocument.accessLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.userName || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>{log.ipAddress || 'Unknown'}</TableCell>
                      <TableCell>
                        {log.success ? (
                          <Badge variant="default">Success</Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No access logs found
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
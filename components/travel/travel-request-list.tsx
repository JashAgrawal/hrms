'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Plane,
  Train,
  Bus,
  Car,
  MapPin,
  CalendarIcon,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface TravelRequest {
  id: string
  title: string
  purpose: string
  destination: string
  fromLocation: string
  startDate: string
  endDate: string
  estimatedCost: number
  actualCost?: number
  travelMode: 'FLIGHT' | 'TRAIN' | 'BUS' | 'CAR' | 'TAXI' | 'OTHER'
  accommodationRequired: boolean
  advanceRequired: boolean
  advanceAmount?: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
  }
  approvals: Array<{
    id: string
    level: number
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    approverName?: string
  }>
  expenseClaims: Array<{
    id: string
    title: string
    amount: number
    status: string
  }>
}

interface TravelRequestListProps {
  onView?: (request: TravelRequest) => void
  onEdit?: (request: TravelRequest) => void
  onDelete?: (request: TravelRequest) => void
  onApprove?: (request: TravelRequest) => void
  showEmployeeColumn?: boolean
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
  COMPLETED: 'bg-blue-100 text-blue-800 border-blue-200',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
}

const travelModeIcons = {
  FLIGHT: Plane,
  TRAIN: Train,
  BUS: Bus,
  CAR: Car,
  TAXI: Car,
  OTHER: MapPin,
}

export function TravelRequestList({
  onView,
  onEdit,
  onDelete,
  onApprove,
  showEmployeeColumn = false,
}: TravelRequestListProps) {
  const [travelRequests, setTravelRequests] = useState<TravelRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateRange, setDateRange] = useState<{
    from?: Date
    to?: Date
  } | undefined>(undefined)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })

  const fetchTravelRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (statusFilter) params.append('status', statusFilter)
      if (dateRange?.from) params.append('startDate', dateRange.from.toISOString())
      if (dateRange?.to) params.append('endDate', dateRange.to.toISOString())

      const response = await fetch(`/api/travel-requests?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTravelRequests(data.data)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching travel requests:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTravelRequests()
  }, [pagination.page, statusFilter, dateRange])

  const filteredRequests = travelRequests.filter(request =>
    request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.employee.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getApprovalStatus = (approvals: TravelRequest['approvals']) => {
    const pendingCount = approvals.filter(a => a.status === 'PENDING').length
    const approvedCount = approvals.filter(a => a.status === 'APPROVED').length
    const rejectedCount = approvals.filter(a => a.status === 'REJECTED').length

    if (rejectedCount > 0) return 'Rejected'
    if (pendingCount === 0 && approvedCount > 0) return 'Fully Approved'
    if (approvedCount > 0) return `${approvedCount}/${approvals.length} Approved`
    return 'Pending Approval'
  }

  const canUserApprove = (request: TravelRequest) => {
    // This would be determined based on user permissions and approval workflow
    return request.status === 'PENDING' && onApprove
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Travel Requests
          </CardTitle>
          <CardDescription>
            Manage and track travel requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, destination, or employee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd")} -{" "}
                        {format(dateRange.to, "LLL dd")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange as any}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Travel Requests Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  {showEmployeeColumn && <TableHead>Employee</TableHead>}
                  <TableHead>Travel Details</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={showEmployeeColumn ? 8 : 7} className="text-center py-8">
                      Loading travel requests...
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showEmployeeColumn ? 8 : 7} className="text-center py-8">
                      No travel requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => {
                    const TravelIcon = travelModeIcons[request.travelMode]
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{request.title}</div>
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {request.purpose}
                            </div>
                          </div>
                        </TableCell>
                        
                        {showEmployeeColumn && (
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {request.employee.firstName} {request.employee.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {request.employee.employeeCode}
                              </div>
                            </div>
                          </TableCell>
                        )}

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TravelIcon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {request.fromLocation} → {request.destination}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {request.travelMode.charAt(0) + request.travelMode.slice(1).toLowerCase()}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {format(new Date(request.startDate), 'MMM dd')} - {format(new Date(request.endDate), 'MMM dd')}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-medium">
                              ₹{request.estimatedCost.toLocaleString()}
                            </div>
                            {request.actualCost && (
                              <div className="text-sm text-muted-foreground">
                                Actual: ₹{request.actualCost.toLocaleString()}
                              </div>
                            )}
                            {request.advanceRequired && (
                              <div className="text-xs text-blue-600">
                                Advance: ₹{request.advanceAmount?.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge className={cn("border", statusColors[request.status])}>
                            {request.status.charAt(0) + request.status.slice(1).toLowerCase()}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm">
                            {getApprovalStatus(request.approvals)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onView && (
                                <DropdownMenuItem onClick={() => onView(request)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                              )}
                              
                              {onEdit && request.status === 'PENDING' && (
                                <DropdownMenuItem onClick={() => onEdit(request)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              
                              {canUserApprove(request) && (
                                <DropdownMenuItem onClick={() => onApprove!(request)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Approve/Reject
                                </DropdownMenuItem>
                              )}
                              
                              {onDelete && request.status !== 'COMPLETED' && (
                                <DropdownMenuItem 
                                  onClick={() => onDelete(request)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Cancel
                                </DropdownMenuItem>
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
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
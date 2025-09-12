'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DepartmentSelect } from '@/components/ui/department-select'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  Building,
  User,
  Filter,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  designation: string
  joiningDate: Date
  status: string
  employmentType: string
  address?: {
    street?: string
    city?: string
    state?: string
    pincode?: string
    country?: string
  }
  user: {
    id: string
    role: string
    isActive: boolean
  }
  department: {
    id: string
    name: string
    code: string
  }
  manager?: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
  }
}

interface EmployeeDirectoryResponse {
  employees: Employee[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface Department {
  id: string
  name: string
  code: string
  _count: {
    employees: number
  }
}

interface EmployeeDirectoryProps {
  searchParams: { [key: string]: string | string[] | undefined }
  departments: Department[]
  designations: string[]
}

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  INACTIVE: 'bg-gray-100 text-gray-800 border-gray-200',
  ON_LEAVE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  TERMINATED: 'bg-red-100 text-red-800 border-red-200',
}

const employmentTypeColors = {
  FULL_TIME: 'bg-blue-100 text-blue-800 border-blue-200',
  PART_TIME: 'bg-purple-100 text-purple-800 border-purple-200',
  CONTRACT: 'bg-orange-100 text-orange-800 border-orange-200',
  INTERN: 'bg-pink-100 text-pink-800 border-pink-200',
}

export function EmployeeDirectory({ 
  searchParams, 
  departments, 
  designations 
}: EmployeeDirectoryProps) {
  const [data, setData] = useState<EmployeeDirectoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  
  // Filter states
  const [searchTerm, setSearchTerm] = useState(searchParams.search as string || '')
  const [selectedDepartment, setSelectedDepartment] = useState(searchParams.department as string || '')
  const [selectedDesignation, setSelectedDesignation] = useState(searchParams.designation as string || '')
  const [selectedStatus, setSelectedStatus] = useState(searchParams.status as string || '')
  const [selectedEmploymentType, setSelectedEmploymentType] = useState(searchParams.employmentType as string || '')
  const [showFilters, setShowFilters] = useState(false)

  const page = Number(searchParams.page) || 1
  const limit = 12 // Grid view works better with 12 items per page

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedDepartment && { department: selectedDepartment }),
        ...(selectedDesignation && { designation: selectedDesignation }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(selectedEmploymentType && { employmentType: selectedEmploymentType }),
      })

      const response = await fetch(`/api/employees?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch employees')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [page, searchTerm, selectedDepartment, selectedDesignation, selectedStatus, selectedEmploymentType])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedDepartment('')
    setSelectedDesignation('')
    setSelectedStatus('')
    setSelectedEmploymentType('')
  }

  const hasActiveFilters = searchTerm || selectedDepartment || selectedDesignation || selectedStatus || selectedEmploymentType

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Search and Filters Skeleton */}
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
        
        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex flex-col items-center space-y-3">
                  <div className="h-16 w-16 rounded-full bg-gray-200 animate-pulse" />
                  <div className="space-y-2 text-center w-full">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mx-auto" />
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2 mx-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-red-600">Error: {error}</p>
          <Button onClick={fetchEmployees} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search employees by name, email, employee code, or designation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1">
                {[searchTerm, selectedDepartment, selectedDesignation, selectedStatus, selectedEmploymentType]
                  .filter(Boolean).length}
              </Badge>
            )}
          </Button>
          
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="flex items-center gap-2">
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
            <div>
              <label className="text-sm font-medium mb-2 block">Department</label>
              <DepartmentSelect
                departments={departments}
                value={selectedDepartment}
                onValueChange={setSelectedDepartment}
                placeholder="All Departments"
                showEmployeeCount={true}
                allowClear={true}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Designation</label>
              <Select value={selectedDesignation} onValueChange={setSelectedDesignation}>
                <SelectTrigger>
                  <SelectValue placeholder="All Designations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Designations</SelectItem>
                  {designations.map((designation) => (
                    <SelectItem key={designation} value={designation}>
                      {designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  <SelectItem value="TERMINATED">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Employment Type</label>
              <Select value={selectedEmploymentType} onValueChange={setSelectedEmploymentType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="FULL_TIME">Full Time</SelectItem>
                  <SelectItem value="PART_TIME">Part Time</SelectItem>
                  <SelectItem value="CONTRACT">Contract</SelectItem>
                  <SelectItem value="INTERN">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      {data && (
        <div className="text-sm text-muted-foreground">
          Showing {data.employees.length} of {data.pagination.total} employees
        </div>
      )}

      {/* Employee Grid */}
      {data && data.employees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.employees.map((employee) => (
            <Dialog key={employee.id}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center space-y-3">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src="" alt={`${employee.firstName} ${employee.lastName}`} />
                        <AvatarFallback className="text-lg">
                          {getInitials(employee.firstName, employee.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="text-center space-y-1">
                        <h3 className="font-semibold text-sm">
                          {employee.firstName} {employee.lastName}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {employee.employeeCode}
                        </p>
                        <p className="text-xs font-medium">
                          {employee.designation}
                        </p>
                        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                          <Building className="h-3 w-3" />
                          {employee.department.name}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 justify-center">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${statusColors[employee.status as keyof typeof statusColors]}`}
                        >
                          {employee.status.replace('_', ' ')}
                        </Badge>
                        <Badge 
                          variant="outline"
                          className={`text-xs ${employmentTypeColors[employee.employmentType as keyof typeof employmentTypeColors]}`}
                        >
                          {employee.employmentType.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>
              
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src="" alt={`${employee.firstName} ${employee.lastName}`} />
                      <AvatarFallback>
                        {getInitials(employee.firstName, employee.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div>{employee.firstName} {employee.lastName}</div>
                      <div className="text-sm text-muted-foreground font-normal">
                        {employee.employeeCode}
                      </div>
                    </div>
                  </DialogTitle>
                  <DialogDescription>
                    Employee contact information and details
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Designation</label>
                      <p className="text-sm">{employee.designation}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Department</label>
                      <p className="text-sm">{employee.department.name}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${employee.email}`} className="text-sm hover:underline">
                        {employee.email}
                      </a>
                    </div>
                    
                    {employee.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${employee.phone}`} className="text-sm hover:underline">
                          {employee.phone}
                        </a>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Joined {formatDate(employee.joiningDate)}
                      </span>
                    </div>
                    
                    {employee.address?.city && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {employee.address.city}
                          {employee.address.state && `, ${employee.address.state}`}
                        </span>
                      </div>
                    )}
                    
                    {employee.manager && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Reports to {employee.manager.firstName} {employee.manager.lastName}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant="outline" 
                      className={statusColors[employee.status as keyof typeof statusColors]}
                    >
                      {employee.status.replace('_', ' ')}
                    </Badge>
                    <Badge 
                      variant="outline"
                      className={employmentTypeColors[employee.employmentType as keyof typeof employmentTypeColors]}
                    >
                      {employee.employmentType.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No employees found matching your criteria.</p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{' '}
            {data.pagination.total} employees
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.pagination.page <= 1}
              onClick={() => {
                const newParams = new URLSearchParams(window.location.search)
                newParams.set('page', (data.pagination.page - 1).toString())
                window.history.pushState({}, '', `${window.location.pathname}?${newParams}`)
                fetchEmployees()
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="text-sm">
              Page {data.pagination.page} of {data.pagination.pages}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              disabled={data.pagination.page >= data.pagination.pages}
              onClick={() => {
                const newParams = new URLSearchParams(window.location.search)
                newParams.set('page', (data.pagination.page + 1).toString())
                window.history.pushState({}, '', `${window.location.pathname}?${newParams}`)
                fetchEmployees()
              }}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
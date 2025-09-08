'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  Eye, 
  Edit, 
  MoreHorizontal, 
  Mail, 
  Phone,
  Calendar,
  Building,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { EmployeeBulkActions } from './employee-bulk-actions'

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

interface EmployeeListResponse {
  employees: Employee[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface EmployeeListProps {
  searchParams: { [key: string]: string | string[] | undefined }
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

export function EmployeeList({ searchParams }: EmployeeListProps) {
  const [data, setData] = useState<EmployeeListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])

  const page = Number(searchParams.page) || 1
  const limit = Number(searchParams.limit) || 10
  const search = searchParams.search as string || ''
  const department = searchParams.department as string || ''
  const status = searchParams.status as string || ''
  const employmentType = searchParams.employmentType as string || ''

  useEffect(() => {
    fetchEmployees()
  }, [page, limit, search, department, status, employmentType])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(department && { department }),
        ...(status && { status }),
        ...(employmentType && { employmentType }),
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
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked && data) {
      setSelectedEmployees(data.employees.map(emp => emp.id))
    } else {
      setSelectedEmployees([])
    }
  }

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees(prev => [...prev, employeeId])
    } else {
      setSelectedEmployees(prev => prev.filter(id => id !== employeeId))
    }
  }

  const isAllSelected = data ? selectedEmployees.length === data.employees.length && data.employees.length > 0 : false
  const isIndeterminate = selectedEmployees.length > 0 && selectedEmployees.length < (data?.employees.length || 0)

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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

  if (!data || data.employees.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No employees found.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      <EmployeeBulkActions
        selectedEmployees={selectedEmployees}
        onSelectionChange={setSelectedEmployees}
        onActionComplete={fetchEmployees}
      />

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all employees"
                />
              </TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Employment Type</TableHead>
              <TableHead>Joining Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedEmployees.includes(employee.id)}
                    onCheckedChange={(checked) => handleSelectEmployee(employee.id, checked as boolean)}
                    aria-label={`Select ${employee.firstName} ${employee.lastName}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="" alt={`${employee.firstName} ${employee.lastName}`} />
                      <AvatarFallback>
                        {getInitials(employee.firstName, employee.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {employee.employeeCode}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {employee.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    {employee.department.name}
                  </div>
                </TableCell>
                <TableCell>{employee.designation}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={statusColors[employee.status as keyof typeof statusColors]}
                  >
                    {employee.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline"
                    className={employmentTypeColors[employee.employmentType as keyof typeof employmentTypeColors]}
                  >
                    {employee.employmentType.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(employee.joiningDate)}
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
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/employees/${employee.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/employees/${employee.id}/edit`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Profile
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {data.employees.map((employee) => (
          <Card key={employee.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src="" alt={`${employee.firstName} ${employee.lastName}`} />
                    <AvatarFallback>
                      {getInitials(employee.firstName, employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {employee.employeeCode} • {employee.designation}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {employee.department.name}
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/employees/${employee.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/employees/${employee.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="mt-3 flex flex-wrap gap-2">
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
              
              <div className="mt-3 text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {employee.email}
                </div>
                {employee.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {employee.phone}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {formatDate(employee.joiningDate)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {data.pagination.pages > 1 && (
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
              asChild
            >
              <Link 
                href={{
                  pathname: '/dashboard/employees',
                  query: { 
                    ...searchParams, 
                    page: data.pagination.page - 1 
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            </Button>
            
            <div className="text-sm">
              Page {data.pagination.page} of {data.pagination.pages}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              disabled={data.pagination.page >= data.pagination.pages}
              asChild
            >
              <Link 
                href={{
                  pathname: '/dashboard/employees',
                  query: { 
                    ...searchParams, 
                    page: data.pagination.page + 1 
                  }
                }}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
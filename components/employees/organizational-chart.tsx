'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Building, 
  Users, 
  Mail, 
  Phone, 
  Calendar,
  MapPin,
  ChevronDown,
  ChevronRight,
  Expand,
  Minimize
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
    city?: string
    state?: string
  }
  department: {
    id: string
    name: string
    code: string
  }
  subordinates: Employee[]
}

interface Department {
  id: string
  name: string
  code: string
  employees: Employee[]
}

interface OrganizationalData {
  departments: Department[]
  hierarchy: Employee[]
}

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  INACTIVE: 'bg-gray-100 text-gray-800 border-gray-200',
  ON_LEAVE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  TERMINATED: 'bg-red-100 text-red-800 border-red-200',
}

export function OrganizationalChart() {
  const [data, setData] = useState<OrganizationalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'hierarchy' | 'department'>('hierarchy')

  useEffect(() => {
    fetchOrganizationalData()
  }, [])

  const fetchOrganizationalData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/employees/organizational-chart')
      if (!response.ok) {
        throw new Error('Failed to fetch organizational data')
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

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const expandAll = () => {
    if (!data) return
    const allIds = new Set<string>()
    
    const collectIds = (employees: Employee[]) => {
      employees.forEach(emp => {
        allIds.add(emp.id)
        if (emp.subordinates.length > 0) {
          collectIds(emp.subordinates)
        }
      })
    }
    
    if (viewMode === 'hierarchy') {
      collectIds(data.hierarchy)
    } else {
      data.departments.forEach(dept => collectIds(dept.employees))
    }
    
    setExpandedNodes(allIds)
  }

  const collapseAll = () => {
    setExpandedNodes(new Set())
  }

  const renderEmployeeCard = (employee: Employee, level: number = 0) => {
    const hasSubordinates = employee.subordinates.length > 0
    const isExpanded = expandedNodes.has(employee.id)

    return (
      <div key={employee.id} className="space-y-2">
        <div 
          className={`flex items-center space-x-2 ${level > 0 ? 'ml-8' : ''}`}
          style={{ marginLeft: level * 32 }}
        >
          {hasSubordinates && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleNodeExpansion(employee.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          
          <Dialog>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:shadow-md transition-shadow flex-1">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="" alt={`${employee.firstName} ${employee.lastName}`} />
                      <AvatarFallback className="text-sm">
                        {getInitials(employee.firstName, employee.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm truncate">
                            {employee.firstName} {employee.lastName}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {employee.designation}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building className="h-3 w-3" />
                            {employee.department.name}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end space-y-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${statusColors[employee.status as keyof typeof statusColors]}`}
                          >
                            {employee.status.replace('_', ' ')}
                          </Badge>
                          {hasSubordinates && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {employee.subordinates.length}
                            </div>
                          )}
                        </div>
                      </div>
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
                  Employee details and contact information
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
                </div>
                
                {hasSubordinates && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Team Members</label>
                    <div className="mt-2 space-y-1">
                      {employee.subordinates.map(subordinate => (
                        <div key={subordinate.id} className="text-sm flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(subordinate.firstName, subordinate.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          {subordinate.firstName} {subordinate.lastName}
                          <span className="text-muted-foreground">- {subordinate.designation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Badge 
                  variant="outline" 
                  className={statusColors[employee.status as keyof typeof statusColors]}
                >
                  {employee.status.replace('_', ' ')}
                </Badge>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {hasSubordinates && isExpanded && (
          <div className="space-y-2">
            {employee.subordinates.map(subordinate => 
              renderEmployeeCard(subordinate, level + 1)
            )}
          </div>
        )}
      </div>
    )
  }

  const renderDepartmentView = () => {
    if (!data) return null

    const filteredDepartments = selectedDepartment 
      ? data.departments.filter(dept => dept.id === selectedDepartment)
      : data.departments

    return (
      <div className="space-y-6">
        {filteredDepartments.map(department => (
          <div key={department.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">{department.name}</h3>
                <Badge variant="outline">
                  {department.employees.length} employees
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              {department.employees.map(employee => renderEmployeeCard(employee))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4" />
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
          <Button onClick={fetchOrganizationalData} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No organizational data found.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          <Select value={viewMode} onValueChange={(value: 'hierarchy' | 'department') => setViewMode(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hierarchy">Hierarchy View</SelectItem>
              <SelectItem value="department">Department View</SelectItem>
            </SelectContent>
          </Select>
          
          {viewMode === 'department' && (
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Departments</SelectItem>
                {data.departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name} ({dept.employees.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            <Expand className="h-4 w-4 mr-1" />
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            <Minimize className="h-4 w-4 mr-1" />
            Collapse All
          </Button>
        </div>
      </div>

      {/* Organizational Chart */}
      <div className="space-y-4">
        {viewMode === 'hierarchy' ? (
          <div className="space-y-2">
            {data.hierarchy.map(employee => renderEmployeeCard(employee))}
          </div>
        ) : (
          renderDepartmentView()
        )}
      </div>
    </div>
  )
}
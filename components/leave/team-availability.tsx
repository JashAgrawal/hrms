'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isWeekend } from 'date-fns'
import { Users, Calendar, AlertTriangle, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  department: {
    id: string
    name: string
    code: string
  }
}

interface LeaveData {
  id: string
  startDate: string
  endDate: string
  status: string
  policy: {
    name: string
    code: string
    type: string
  }
  isHalfDay: boolean
  halfDayType?: string
}

interface EmployeeAvailability {
  employee: Employee
  leaves: LeaveData[]
  availabilityPercentage: number
  totalLeaveDays: number
  isOnLeave: boolean
}

interface DepartmentAvailability {
  department: {
    id: string
    name: string
    code: string
  }
  totalEmployees: number
  availableEmployees: number
  onLeaveEmployees: number
  availabilityPercentage: number
  employees: EmployeeAvailability[]
}

export function TeamAvailability() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [departments, setDepartments] = useState<DepartmentAvailability[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [weekDays, setWeekDays] = useState<Date[]>([])
  const { toast } = useToast()

  const fetchAvailabilityData = async () => {
    try {
      setLoading(true)
      
      // Calculate week range
      const weekStart = startOfWeek(currentWeek)
      const weekEnd = endOfWeek(currentWeek)
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
      setWeekDays(days)

      const params = new URLSearchParams()
      params.append('startDate', format(weekStart, 'yyyy-MM-dd'))
      params.append('endDate', format(weekEnd, 'yyyy-MM-dd'))
      if (selectedDepartment) {
        params.append('departmentId', selectedDepartment)
      }

      const response = await fetch(`/api/leave/availability?${params}`)
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments || [])
      } else {
        throw new Error('Failed to fetch availability data')
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch team availability',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAvailabilityData()
  }, [currentWeek, selectedDepartment])

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => addDays(prev, direction === 'prev' ? -7 : 7))
  }

  const getAvailabilityColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAvailabilityBgColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-100'
    if (percentage >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const isEmployeeOnLeaveOnDay = (employee: EmployeeAvailability, day: Date) => {
    return employee.leaves.some(leave => {
      const leaveStart = new Date(leave.startDate)
      const leaveEnd = new Date(leave.endDate)
      return day >= leaveStart && day <= leaveEnd && leave.status === 'APPROVED'
    })
  }

  const getEmployeeLeaveOnDay = (employee: EmployeeAvailability, day: Date) => {
    return employee.leaves.find(leave => {
      const leaveStart = new Date(leave.startDate)
      const leaveEnd = new Date(leave.endDate)
      return day >= leaveStart && day <= leaveEnd && leave.status === 'APPROVED'
    })
  }

  const getLeaveTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ANNUAL: 'bg-blue-500',
      SICK: 'bg-red-500',
      CASUAL: 'bg-green-500',
      MATERNITY: 'bg-pink-500',
      PATERNITY: 'bg-purple-500',
      EMERGENCY: 'bg-orange-500',
      COMPENSATORY: 'bg-yellow-500',
    }
    return colors[type] || 'bg-gray-500'
  }

  const allDepartments = departments.map(d => d.department)
  const totalEmployees = departments.reduce((sum, dept) => sum + dept.totalEmployees, 0)
  const totalAvailable = departments.reduce((sum, dept) => sum + dept.availableEmployees, 0)
  const totalOnLeave = departments.reduce((sum, dept) => sum + dept.onLeaveEmployees, 0)
  const overallAvailability = totalEmployees > 0 ? (totalAvailable / totalEmployees) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team Availability</h2>
          <p className="text-muted-foreground">
            Monitor team availability and plan resource allocation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Departments</SelectItem>
              {allDepartments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg">
                Week of {format(startOfWeek(currentWeek), 'MMM d')} - {format(endOfWeek(currentWeek), 'MMM d, yyyy')}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(new Date())}
            >
              This Week
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Overall Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Active employees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', getAvailabilityColor(overallAvailability))}>
              {totalAvailable}
            </div>
            <p className="text-xs text-muted-foreground">
              {overallAvailability.toFixed(1)}% availability
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Leave</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalOnLeave}</div>
            <p className="text-xs text-muted-foreground">
              Currently unavailable
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Departments</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {departments.filter(d => d.availabilityPercentage < 60).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Below 60% availability
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department Availability */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading availability data...</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {departments.map((dept) => (
            <Card key={dept.department.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{dept.department.name}</CardTitle>
                    <CardDescription>
                      {dept.availableEmployees} of {dept.totalEmployees} available
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className={cn('text-2xl font-bold', getAvailabilityColor(dept.availabilityPercentage))}>
                      {dept.availabilityPercentage.toFixed(1)}%
                    </div>
                    <Progress 
                      value={dept.availabilityPercentage} 
                      className="w-24 mt-1"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Week view header */}
                  <div className="grid grid-cols-8 gap-2 text-sm font-medium text-muted-foreground">
                    <div>Employee</div>
                    {weekDays.map((day) => (
                      <div key={day.toISOString()} className="text-center">
                        <div>{format(day, 'EEE')}</div>
                        <div className="text-xs">{format(day, 'd')}</div>
                      </div>
                    ))}
                  </div>

                  {/* Employee availability grid */}
                  <div className="space-y-2">
                    {dept.employees.map((emp) => (
                      <div key={emp.employee.id} className="grid grid-cols-8 gap-2 items-center">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {emp.employee.firstName[0]}{emp.employee.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {emp.employee.firstName} {emp.employee.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {emp.employee.employeeCode}
                            </div>
                          </div>
                        </div>

                        {weekDays.map((day) => {
                          const isOnLeave = isEmployeeOnLeaveOnDay(emp, day)
                          const leave = getEmployeeLeaveOnDay(emp, day)
                          const isWeekendDay = isWeekend(day)

                          return (
                            <div
                              key={day.toISOString()}
                              className={cn(
                                'h-12 rounded border flex items-center justify-center text-xs',
                                isWeekendDay && 'bg-muted/30',
                                isOnLeave && 'border-2',
                                !isOnLeave && !isWeekendDay && 'bg-green-50 border-green-200',
                                !isOnLeave && isWeekendDay && 'bg-muted/50'
                              )}
                              style={{
                                borderColor: isOnLeave && leave ? 
                                  getLeaveTypeColor(leave.policy.type).replace('bg-', '#') : 
                                  undefined
                              }}
                            >
                              {isOnLeave && leave ? (
                                <div className="text-center">
                                  <div className="font-medium">{leave.policy.code}</div>
                                  {leave.isHalfDay && (
                                    <div className="text-xs">
                                      {leave.halfDayType === 'FIRST_HALF' ? 'AM' : 'PM'}
                                    </div>
                                  )}
                                </div>
                              ) : isWeekendDay ? (
                                <div className="text-muted-foreground">-</div>
                              ) : (
                                <div className="text-green-600 font-medium">✓</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>

                  {dept.employees.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No employees found in this department
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Availability Status</div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-50 border border-green-200 rounded flex items-center justify-center">
                  <span className="text-green-600 text-xs">✓</span>
                </div>
                <span className="text-sm">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-muted/50 rounded flex items-center justify-center">
                  <span className="text-muted-foreground text-xs">-</span>
                </div>
                <span className="text-sm">Weekend</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium">Leave Types</div>
              <div className="grid gap-1 grid-cols-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-sm">AL - Annual</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-sm">SL - Sick</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-sm">CL - Casual</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span className="text-sm">EL - Emergency</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
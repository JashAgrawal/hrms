"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, Calendar, Clock, User } from "lucide-react"
import { useEffect, useState } from "react"
import { format, isToday, parseISO } from "date-fns"

interface EmployeeOnLeave {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  avatar?: string
  leaveType: string
  startDate: string
  endDate: string
  isHalfDay: boolean
  reason?: string
}

export function OnLeaveTodayCard() {
  const [employeesOnLeave, setEmployeesOnLeave] = useState<EmployeeOnLeave[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    const fetchEmployeesOnLeave = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const response = await fetch(`/api/leave/requests?date=${today}&status=APPROVED`)
        
        if (response.ok) {
          const data = await response.json()
          const onLeaveToday = (data.requests || [])
            .filter((request: any) => {
              const startDate = parseISO(request.startDate)
              const endDate = parseISO(request.endDate)
              const today = new Date()
              return today >= startDate && today <= endDate
            })
            .map((request: any) => ({
              id: request.employee.id,
              firstName: request.employee.firstName,
              lastName: request.employee.lastName,
              email: request.employee.email,
              department: request.employee.department?.name || 'N/A',
              position: request.employee.position || 'N/A',
              avatar: request.employee.avatar,
              leaveType: request.type,
              startDate: request.startDate,
              endDate: request.endDate,
              isHalfDay: request.isHalfDay || false,
              reason: request.reason
            }))
          
          setEmployeesOnLeave(onLeaveToday.slice(0, 8)) // Show max 8 employees
          setTotalCount(onLeaveToday.length)
        } else {
          console.error('Failed to fetch employees on leave:', response.status)
          setEmployeesOnLeave([])
          setTotalCount(0)
        }
      } catch (error) {
        console.error('Failed to fetch employees on leave:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEmployeesOnLeave()
  }, [])

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  const getLeaveTypeBadge = (leaveType: string, isHalfDay: boolean) => {
    const type = isHalfDay ? 'Half Day' : leaveType
    
    switch (leaveType.toLowerCase()) {
      case 'annual leave':
      case 'vacation':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">{type}</Badge>
      case 'sick leave':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">{type}</Badge>
      case 'personal leave':
        return <Badge variant="outline" className="bg-green-100 text-green-800">{type}</Badge>
      case 'maternity leave':
      case 'paternity leave':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">{type}</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const formatLeaveDate = (startDate: string, endDate: string) => {
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    
    if (isToday(start) && isToday(end)) {
      return 'Today'
    }
    
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return format(start, 'MMM dd')
    }
    
    return `${format(start, 'MMM dd')} - ${format(end, 'MMM dd')}`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            On Leave Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          On Leave Today
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {totalCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {employeesOnLeave.length === 0 ? (
          <div className="text-center py-6">
            <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No one is on leave today
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              All team members are available
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {employeesOnLeave.map((employee) => (
              <div key={employee.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={employee.avatar} />
                  <AvatarFallback className="text-xs">
                    {getInitials(employee.firstName, employee.lastName)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">
                      {employee.firstName} {employee.lastName}
                    </p>
                    {getLeaveTypeBadge(employee.leaveType, employee.isHalfDay)}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {employee.department}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatLeaveDate(employee.startDate, employee.endDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {totalCount > employeesOnLeave.length && (
              <div className="text-center pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  +{totalCount - employeesOnLeave.length} more employee{totalCount - employeesOnLeave.length > 1 ? 's' : ''} on leave
                </p>
              </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        {employeesOnLeave.length > 0 && (
          <div className="pt-3 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm font-semibold">
                  {employeesOnLeave.filter(e => !e.isHalfDay).length}
                </p>
                <p className="text-xs text-muted-foreground">Full Day</p>
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {employeesOnLeave.filter(e => e.isHalfDay).length}
                </p>
                <p className="text-xs text-muted-foreground">Half Day</p>
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {new Set(employeesOnLeave.map(e => e.department)).size}
                </p>
                <p className="text-xs text-muted-foreground">Departments</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
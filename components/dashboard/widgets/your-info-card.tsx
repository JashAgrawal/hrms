"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User, MapPin, Calendar, FileText, Clock } from "lucide-react"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"

interface EmployeeInfo {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeCode: string
  department: string
  position: string
  joinDate: string
  leaveBalance: number
  documentsToSubmit: number
  workLocation: string
  workingHours: string
}

export function YourInfoCard() {
  const { data: session } = useSession()
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEmployeeInfo = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          setEmployeeInfo(data.employee)
        }
      } catch (error) {
        console.error('Failed to fetch employee info:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchEmployeeInfo()
    }
  }, [session])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Your Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  const formatJoinDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Your Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Profile Section */}
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={session?.user?.image || ''} />
            <AvatarFallback>
              {employeeInfo 
                ? getInitials(employeeInfo.firstName, employeeInfo.lastName)
                : session?.user?.name?.[0]?.toUpperCase() || 'U'
              }
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold">
              {employeeInfo 
                ? `${employeeInfo.firstName} ${employeeInfo.lastName}`
                : session?.user?.name || 'User'
              }
            </h3>
            <p className="text-sm text-muted-foreground">
              {employeeInfo?.employeeCode || 'EMP001'}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Leave Balance</span>
            </div>
            <p className="text-sm font-medium">
              {employeeInfo?.leaveBalance || 18} days
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pending Docs</span>
            </div>
            <p className="text-sm font-medium">
              {employeeInfo?.documentsToSubmit || 0} items
            </p>
          </div>
        </div>

        {/* Department & Position */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Department</span>
            <Badge variant="secondary" className="text-xs">
              {employeeInfo?.department || 'Engineering'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Position</span>
            <span className="text-xs font-medium">
              {employeeInfo?.position || 'Software Engineer'}
            </span>
          </div>
        </div>

        {/* Work Details */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {employeeInfo?.workLocation || 'Hybrid'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {employeeInfo?.workingHours || '9:00 AM - 6:00 PM'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Joined {employeeInfo?.joinDate ? formatJoinDate(employeeInfo.joinDate) : 'Jan 2024'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
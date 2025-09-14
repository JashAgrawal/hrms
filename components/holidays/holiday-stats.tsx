'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  Users, 
  Clock, 
  Settings,
  TrendingUp,
  CheckCircle
} from 'lucide-react'

interface Holiday {
  id: string
  name: string
  date: string
  type: 'PUBLIC' | 'COMPANY' | 'OPTIONAL' | 'RELIGIOUS' | 'NATIONAL'
  description?: string
  isOptional: boolean
  isActive: boolean
  year: number
}

interface OptionalLeavePolicy {
  id: string
  name: string
  year: number
  maxSelectableLeaves: number
  selectionDeadline?: string
  isActive: boolean
  _count: {
    holidays: number
    employeeSelections: number
  }
}

interface HolidayStatsProps {
  holidays: Holiday[]
  optionalPolicies: OptionalLeavePolicy[]
  year: number
}

export function HolidayStats({ holidays, optionalPolicies, year }: HolidayStatsProps) {
  const totalHolidays = holidays.filter(h => h.isActive).length
  const upcomingHolidays = holidays.filter(h => {
    const holidayDate = new Date(h.date)
    const today = new Date()
    return h.isActive && holidayDate >= today
  }).length

  const optionalHolidays = holidays.filter(h => h.isOptional && h.isActive).length
  const activePolicies = optionalPolicies.filter(p => p.isActive).length
  
  const totalOptionalSelections = optionalPolicies.reduce((sum, policy) => 
    sum + policy._count.employeeSelections, 0
  )

  const averageSelectionRate = activePolicies > 0 
    ? Math.round((totalOptionalSelections / (activePolicies * 100)) * 100) // Assuming 100 employees for demo
    : 0

  const stats = [
    {
      title: 'Total Holidays',
      value: totalHolidays,
      description: `${upcomingHolidays} upcoming this year`,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Optional Holidays',
      value: optionalHolidays,
      description: `${activePolicies} active policies`,
      icon: Settings,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Employee Selections',
      value: totalOptionalSelections,
      description: `${averageSelectionRate}% participation rate`,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Policies Active',
      value: activePolicies,
      description: `For year ${year}`,
      icon: CheckCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-md ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function HolidayTypeBreakdown({ holidays }: { holidays: Holiday[] }) {
  const typeStats = holidays.reduce((acc, holiday) => {
    if (holiday.isActive) {
      acc[holiday.type] = (acc[holiday.type] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  const typeColors = {
    PUBLIC: 'bg-blue-500',
    COMPANY: 'bg-green-500',
    OPTIONAL: 'bg-purple-500',
    RELIGIOUS: 'bg-orange-500',
    NATIONAL: 'bg-red-500'
  }

  const typeLabels = {
    PUBLIC: 'Public Holidays',
    COMPANY: 'Company Holidays',
    OPTIONAL: 'Optional Holidays',
    RELIGIOUS: 'Religious Holidays',
    NATIONAL: 'National Holidays'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Holiday Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(typeStats).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div 
                  className={`w-3 h-3 rounded-full ${typeColors[type as keyof typeof typeColors]}`}
                />
                <span className="text-sm font-medium">
                  {typeLabels[type as keyof typeof typeLabels]}
                </span>
              </div>
              <Badge variant="secondary">{count}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function UpcomingHolidaysPreview({ holidays }: { holidays: Holiday[] }) {
  const upcomingHolidays = holidays
    .filter(h => {
      const holidayDate = new Date(h.date)
      const today = new Date()
      return h.isActive && holidayDate >= today
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      weekday: 'short'
    })
  }

  const getTypeColor = (type: string) => {
    const colors = {
      PUBLIC: 'bg-blue-100 text-blue-800',
      COMPANY: 'bg-green-100 text-green-800',
      OPTIONAL: 'bg-purple-100 text-purple-800',
      RELIGIOUS: 'bg-orange-100 text-orange-800',
      NATIONAL: 'bg-red-100 text-red-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Upcoming Holidays
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingHolidays.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming holidays</p>
        ) : (
          <div className="space-y-3">
            {upcomingHolidays.map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{holiday.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(holiday.date)}
                  </p>
                </div>
                <Badge 
                  variant="secondary" 
                  className={getTypeColor(holiday.type)}
                >
                  {holiday.type}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

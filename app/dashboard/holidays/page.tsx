'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Calendar, 
  Plus, 
  Settings, 
  Users, 
  Clock,
  Edit,
  Trash2,
  Eye,
  Filter
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { HolidayCalendar } from '@/components/holidays/holiday-calendar'
import { HolidayList } from '@/components/holidays/holiday-list'
import { CreateHolidayDialog } from '@/components/holidays/create-holiday-dialog'
import { OptionalLeavePolicyManager } from '@/components/holidays/optional-leave-policy-manager'
import { HolidayStats } from '@/components/holidays/holiday-stats'
import { QuickAddHolidays } from '@/components/holidays/quick-add-holidays'

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
  description?: string
  year: number
  maxSelectableLeaves: number
  selectionDeadline?: string
  isActive: boolean
  holidays: Array<{
    holiday: Holiday
  }>
  employeeSelections: Array<{
    employee: {
      id: string
      firstName: string
      lastName: string
      employeeCode: string
    }
    holiday: {
      id: string
      name: string
      date: string
    }
  }>
  _count: {
    holidays: number
    employeeSelections: number
  }
}

export default function HolidaysPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [optionalPolicies, setOptionalPolicies] = useState<OptionalLeavePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [createHolidayOpen, setCreateHolidayOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('calendar')

  // Check if user has HR/Admin permissions
  const isHROrAdmin = Boolean(session?.user?.role && ['HR', 'ADMIN'].includes(session.user.role))

  useEffect(() => {
    fetchHolidays()
    fetchOptionalPolicies()
  }, [selectedYear])

  const fetchHolidays = async () => {
    try {
      const response = await fetch(`/api/holidays?year=${selectedYear}`)
      if (response.ok) {
        const data = await response.json()
        setHolidays(data)
      } else {
        throw new Error('Failed to fetch holidays')
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch holidays',
        variant: 'destructive'
      })
    }
  }

  const fetchOptionalPolicies = async () => {
    try {
      const response = await fetch(`/api/optional-leave-policies?year=${selectedYear}`)
      if (response.ok) {
        const data = await response.json()
        setOptionalPolicies(data)
      } else {
        throw new Error('Failed to fetch optional leave policies')
      }
    } catch (error) {
      console.error('Error fetching optional leave policies:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch optional leave policies',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleHolidayCreated = () => {
    fetchHolidays()
    setCreateHolidayOpen(false)
    toast({
      title: 'Success',
      description: 'Holiday created successfully'
    })
  }

  const handlePolicyUpdated = () => {
    fetchOptionalPolicies()
    toast({
      title: 'Success',
      description: 'Optional leave policy updated successfully'
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Holiday Management</h1>
            <p className="text-muted-foreground">
              Manage company holidays and optional leave policies
            </p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Holiday Management</h1>
          <p className="text-muted-foreground">
            Manage company holidays, festivals, and optional leave policies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - 2 + i
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              )
            })}
          </select>
          {isHROrAdmin && (
            <Button onClick={() => setCreateHolidayOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Holiday
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <HolidayStats 
        holidays={holidays} 
        optionalPolicies={optionalPolicies}
        year={selectedYear}
      />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="holidays">
            <Settings className="h-4 w-4 mr-2" />
            Holidays
          </TabsTrigger>
          <TabsTrigger value="quick-add">
            <Plus className="h-4 w-4 mr-2" />
            Quick Add
          </TabsTrigger>
          <TabsTrigger value="optional-policies">
            <Users className="h-4 w-4 mr-2" />
            Optional Leave
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <Eye className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-6">
          <HolidayCalendar 
            holidays={holidays}
            optionalPolicies={optionalPolicies}
            year={selectedYear}
            onHolidaySelect={(holiday) => {
              // Handle holiday selection
              console.log('Selected holiday:', holiday)
            }}
          />
        </TabsContent>

        <TabsContent value="holidays" className="space-y-6">
          <HolidayList 
            holidays={holidays}
            onHolidayUpdated={fetchHolidays}
            canEdit={isHROrAdmin}
          />
        </TabsContent>

        <TabsContent value="quick-add" className="space-y-6">
          {isHROrAdmin ? (
            <QuickAddHolidays 
              year={selectedYear}
              onHolidaysAdded={fetchHolidays}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                You don't have permission to add holidays.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="optional-policies" className="space-y-6">
          <OptionalLeavePolicyManager
            policies={optionalPolicies}
            holidays={holidays}
            year={selectedYear}
            onPolicyUpdated={handlePolicyUpdated}
            canEdit={isHROrAdmin}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Holiday Distribution</CardTitle>
                <CardDescription>
                  Breakdown of holidays by type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['PUBLIC', 'COMPANY', 'OPTIONAL', 'RELIGIOUS', 'NATIONAL'].map(type => {
                    const count = holidays.filter(h => h.type === type).length
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{type}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Optional Leave Utilization</CardTitle>
                <CardDescription>
                  Employee participation in optional leave policies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {optionalPolicies.map(policy => (
                    <div key={policy.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{policy.name}</span>
                        <Badge variant="outline">
                          {policy._count.employeeSelections} selections
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {policy._count.holidays} holidays available, 
                        max {policy.maxSelectableLeaves} per employee
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Holiday Dialog */}
      <CreateHolidayDialog
        open={createHolidayOpen}
        onOpenChange={setCreateHolidayOpen}
        onHolidayCreated={handleHolidayCreated}
        year={selectedYear}
      />
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Info,
  Save,
  RefreshCw
} from 'lucide-react'
import { format, isBefore } from 'date-fns'

interface Holiday {
  id: string
  name: string
  date: string
  type: 'PUBLIC' | 'COMPANY' | 'OPTIONAL' | 'RELIGIOUS' | 'NATIONAL'
  description?: string
}

interface OptionalLeavePolicy {
  id: string
  name: string
  year: number
  maxSelectableLeaves: number
  selectionDeadline?: string
  availableHolidays: Holiday[]
}

interface EmployeeSelection {
  id: string
  holidayId: string
  selectedAt: string
  holiday: Holiday
}

interface PolicySelectionData {
  policy: OptionalLeavePolicy
  selections: EmployeeSelection[]
  selectedCount: number
  remainingSelections: number
}

export default function OptionalHolidaysPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [policies, setPolicies] = useState<PolicySelectionData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetchOptionalLeavePolicies()
  }, [selectedYear])

  const fetchOptionalLeavePolicies = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/optional-leave-policies?year=${selectedYear}`)
      if (response.ok) {
        const policiesData = await response.json()
        
        // Fetch selections for each policy
        const policiesWithSelections = await Promise.all(
          policiesData.map(async (policy: any) => {
            try {
              const selectionsResponse = await fetch(`/api/optional-leave-policies/${policy.id}/selections`)
              if (selectionsResponse.ok) {
                const selectionData = await selectionsResponse.json()
                return selectionData
              }
              return {
                policy: {
                  id: policy.id,
                  name: policy.name,
                  year: policy.year,
                  maxSelectableLeaves: policy.maxSelectableLeaves,
                  selectionDeadline: policy.selectionDeadline,
                  availableHolidays: policy.holidays.map((h: any) => h.holiday)
                },
                selections: [],
                selectedCount: 0,
                remainingSelections: policy.maxSelectableLeaves
              }
            } catch (error) {
              console.error('Error fetching selections for policy:', policy.id, error)
              return null
            }
          })
        )
        
        setPolicies(policiesWithSelections.filter(Boolean))
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

  const handleSelectionChange = (policyId: string, holidayId: string, selected: boolean) => {
    setPolicies(prevPolicies => 
      prevPolicies.map(policyData => {
        if (policyData.policy.id !== policyId) return policyData

        const currentSelections = policyData.selections.map(s => s.holidayId)
        let newSelections: string[]

        if (selected) {
          // Check if we can add more selections
          if (policyData.selectedCount >= policyData.policy.maxSelectableLeaves) {
            toast({
              title: 'Selection Limit Reached',
              description: `You can only select ${policyData.policy.maxSelectableLeaves} holidays for this policy`,
              variant: 'destructive'
            })
            return policyData
          }
          newSelections = [...currentSelections, holidayId]
        } else {
          newSelections = currentSelections.filter(id => id !== holidayId)
        }

        // Create mock selections for UI update
        const mockSelections = newSelections.map(hId => {
          const holiday = policyData.policy.availableHolidays.find(h => h.id === hId)!
          return {
            id: `temp-${hId}`,
            holidayId: hId,
            selectedAt: new Date().toISOString(),
            holiday
          }
        })

        return {
          ...policyData,
          selections: mockSelections,
          selectedCount: newSelections.length,
          remainingSelections: policyData.policy.maxSelectableLeaves - newSelections.length
        }
      })
    )
  }

  const saveSelections = async (policyId: string) => {
    const policyData = policies.find(p => p.policy.id === policyId)
    if (!policyData) return

    setSaving(policyId)
    try {
      const holidayIds = policyData.selections.map(s => s.holidayId)
      
      const response = await fetch(`/api/optional-leave-policies/${policyId}/selections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ holidayIds }),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Your holiday selections have been saved',
        })
        // Refresh the specific policy data
        fetchOptionalLeavePolicies()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save selections')
      }
    } catch (error) {
      console.error('Error saving selections:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save selections',
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }

  const isDeadlinePassed = (deadline?: string) => {
    if (!deadline) return false
    return isBefore(new Date(deadline), new Date())
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEEE, MMM dd, yyyy')
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Optional Holidays</h1>
            <p className="text-muted-foreground">
              Select your preferred holidays from available festivals
            </p>
          </div>
        </div>
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...Array(3)].map((_, j) => (
                    <Skeleton key={j} className="h-16 w-full" />
                  ))}
                </div>
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
          <h1 className="text-3xl font-bold tracking-tight">Optional Holidays</h1>
          <p className="text-muted-foreground">
            Select your preferred holidays from available festivals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            {[...Array(3)].map((_, i) => {
              const year = new Date().getFullYear() + i
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              )
            })}
          </select>
          <Button variant="outline" onClick={fetchOptionalLeavePolicies}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Policies */}
      {policies.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Optional Holiday Policies</h3>
            <p className="text-muted-foreground">
              There are no optional holiday policies available for {selectedYear}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {policies.map((policyData) => {
            const { policy, selections, selectedCount, remainingSelections } = policyData
            const deadlinePassed = isDeadlinePassed(policy.selectionDeadline)
            const selectedHolidayIds = selections.map(s => s.holidayId)

            return (
              <Card key={policy.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <Calendar className="h-5 w-5 mr-2" />
                        {policy.name}
                      </CardTitle>
                      <CardDescription>
                        Select up to {policy.maxSelectableLeaves} holidays from {policy.availableHolidays.length} available options
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {selectedCount} / {policy.maxSelectableLeaves} selected
                      </div>
                      {policy.selectionDeadline && (
                        <div className={`text-xs ${deadlinePassed ? 'text-red-600' : 'text-muted-foreground'}`}>
                          Deadline: {format(new Date(policy.selectionDeadline), 'MMM dd, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Selection Status */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Selection Status</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant="outline">
                        {remainingSelections} remaining
                      </Badge>
                      {deadlinePassed && (
                        <Badge variant="destructive">
                          <Clock className="h-3 w-3 mr-1" />
                          Deadline Passed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Deadline Warning */}
                  {policy.selectionDeadline && !deadlinePassed && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Make your selections before {formatDate(policy.selectionDeadline)}. 
                        You can change your selections until the deadline.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Holiday Selection Grid */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {policy.availableHolidays
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((holiday) => {
                        const isSelected = selectedHolidayIds.includes(holiday.id)
                        const canSelect = !deadlinePassed && (isSelected || remainingSelections > 0)

                        return (
                          <div
                            key={holiday.id}
                            className={`
                              flex items-center space-x-3 p-4 border rounded-lg transition-colors
                              ${isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'}
                              ${!canSelect ? 'opacity-50' : ''}
                            `}
                          >
                            <Checkbox
                              id={`${policy.id}-${holiday.id}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => 
                                canSelect && handleSelectionChange(policy.id, holiday.id, checked as boolean)
                              }
                              disabled={!canSelect}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <label
                                  htmlFor={`${policy.id}-${holiday.id}`}
                                  className="font-medium cursor-pointer"
                                >
                                  {holiday.name}
                                </label>
                                <Badge className={getTypeColor(holiday.type)}>
                                  {holiday.type}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {formatDate(holiday.date)}
                              </div>
                              {holiday.description && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {holiday.description}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>

                  {/* Save Button */}
                  {!deadlinePassed && (
                    <div className="flex justify-end">
                      <Button
                        onClick={() => saveSelections(policy.id)}
                        disabled={saving === policy.id}
                      >
                        {saving === policy.id ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Selections
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

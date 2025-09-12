'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Car,
  MapPin,
  Calendar,
  Calculator,
  TrendingUp,
  Clock,
  Route,
  Fuel,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'

interface DailyDistance {
  date: string
  totalDistance: number
  checkInCount: number
  locations: Array<{
    siteName: string
    checkInTime: string
    distance?: number
  }>
}

interface MonthlyPetrolExpense {
  id: string
  month: number
  year: number
  totalDistance: number
  totalAmount: number
  ratePerKm: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REIMBURSED'
  expenseClaimId?: string
  createdAt: string
  updatedAt: string
}

interface PetrolExpenseConfig {
  ratePerKm: number
  isActive: boolean
  updatedAt: string
}

interface PetrolExpensePreviewProps {
  employeeId?: string
  selectedMonth?: Date
  onGenerateExpense?: (monthlyExpenseId: string) => void
}

export function PetrolExpensePreview({ 
  employeeId, 
  selectedMonth = new Date(), 
  onGenerateExpense 
}: PetrolExpensePreviewProps) {
  const [dailyDistances, setDailyDistances] = useState<DailyDistance[]>([])
  const [monthlyExpense, setMonthlyExpense] = useState<MonthlyPetrolExpense | null>(null)
  const [petrolConfig, setPetrolConfig] = useState<PetrolExpenseConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const currentMonth = selectedMonth.getMonth() + 1
  const currentYear = selectedMonth.getFullYear()

  // Fetch petrol expense configuration
  const fetchPetrolConfig = async () => {
    try {
      const response = await fetch('/api/expenses/petrol-config')
      if (response.ok) {
        const data = await response.json()
        setPetrolConfig(data)
      }
    } catch (error) {
      console.error('Error fetching petrol config:', error)
    }
  }

  // Fetch daily distance data
  const fetchDailyDistances = async () => {
    try {
      const params = new URLSearchParams({
        month: currentMonth.toString(),
        year: currentYear.toString(),
      })

      if (employeeId) {
        params.append('employeeId', employeeId)
      }

      const response = await fetch(`/api/distance-tracking/daily?${params}`)
      if (response.ok) {
        const data = await response.json()
        setDailyDistances(data)
      }
    } catch (error) {
      console.error('Error fetching daily distances:', error)
    }
  }

  // Fetch monthly petrol expense
  const fetchMonthlyExpense = async () => {
    try {
      const params = new URLSearchParams({
        month: currentMonth.toString(),
        year: currentYear.toString(),
      })

      if (employeeId) {
        params.append('employeeId', employeeId)
      }

      const response = await fetch(`/api/expenses/petrol/monthly?${params}`)
      if (response.ok) {
        const data = await response.json()
        setMonthlyExpense(data.length > 0 ? data[0] : null)
      }
    } catch (error) {
      console.error('Error fetching monthly expense:', error)
    }
  }

  // Load all data
  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchPetrolConfig(),
        fetchDailyDistances(),
        fetchMonthlyExpense()
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedMonth, employeeId])

  // Generate monthly expense
  const handleGenerateExpense = async () => {
    if (!petrolConfig) return

    setGenerating(true)
    try {
      const response = await fetch('/api/expenses/petrol/monthly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month: currentMonth,
          year: currentYear,
          employeeId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setMonthlyExpense(data)
        if (onGenerateExpense) {
          onGenerateExpense(data.id)
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to generate expense')
      }
    } catch (error) {
      console.error('Error generating expense:', error)
      alert('Error generating expense')
    } finally {
      setGenerating(false)
    }
  }

  // Calculate totals
  const totalDistance = dailyDistances.reduce((sum, day) => sum + day.totalDistance, 0)
  const estimatedAmount = petrolConfig ? totalDistance * petrolConfig.ratePerKm : 0
  const workingDays = dailyDistances.filter(day => day.totalDistance > 0).length

  // Get calendar days for the month
  const monthStart = startOfMonth(selectedMonth)
  const monthEnd = endOfMonth(selectedMonth)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get status display
  const getStatusDisplay = (status: MonthlyPetrolExpense['status']) => {
    const configs = {
      PENDING: { label: 'Pending', variant: 'secondary' as const, color: 'text-yellow-600' },
      APPROVED: { label: 'Approved', variant: 'default' as const, color: 'text-green-600' },
      REJECTED: { label: 'Rejected', variant: 'destructive' as const, color: 'text-red-600' },
      REIMBURSED: { label: 'Reimbursed', variant: 'default' as const, color: 'text-blue-600' },
    }
    const config = configs[status]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Petrol Expense Preview</h2>
          <p className="text-muted-foreground">
            {format(selectedMonth, 'MMMM yyyy')} • Distance-based expense calculation
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Configuration Alert */}
      {!petrolConfig?.isActive && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Petrol expense configuration is not active. Please contact your administrator.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Monthly Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Route className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Total Distance</p>
                    <p className="text-2xl font-bold">{totalDistance.toFixed(1)} km</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Working Days</p>
                    <p className="text-2xl font-bold">{workingDays}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Fuel className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium">Rate per KM</p>
                    <p className="text-2xl font-bold">₹{petrolConfig?.ratePerKm || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium">Estimated Amount</p>
                    <p className="text-2xl font-bold">₹{estimatedAmount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Expense Status */}
          {monthlyExpense ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Monthly Expense Status</span>
                  {getStatusDisplay(monthlyExpense.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Distance</p>
                    <p className="text-lg font-semibold">{monthlyExpense.totalDistance.toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rate per KM</p>
                    <p className="text-lg font-semibold">₹{monthlyExpense.ratePerKm}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                    <p className="text-lg font-semibold">₹{monthlyExpense.totalAmount.toLocaleString()}</p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Generated on {format(new Date(monthlyExpense.createdAt), 'PPp')}
                    </p>
                    {monthlyExpense.expenseClaimId && (
                      <p className="text-sm text-muted-foreground">
                        Expense Claim ID: {monthlyExpense.expenseClaimId.slice(-8).toUpperCase()}
                      </p>
                    )}
                  </div>
                  {monthlyExpense.status === 'PENDING' && (
                    <Button variant="outline" size="sm">
                      View Expense Claim
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Generate Monthly Expense</CardTitle>
                <CardDescription>
                  Create an expense claim for this month's petrol expenses based on distance traveled.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Calculator className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Calculation Summary</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Total Distance:</span>
                        <span>{totalDistance.toFixed(1)} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rate per KM:</span>
                        <span>₹{petrolConfig?.ratePerKm || 0}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-medium">
                        <span>Estimated Amount:</span>
                        <span>₹{estimatedAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={handleGenerateExpense}
                    disabled={generating || !petrolConfig?.isActive || totalDistance === 0}
                    className="w-full"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Generate Expense Claim
                      </>
                    )}
                  </Button>

                  {totalDistance === 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      No distance recorded for this month
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Daily Distance Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Distance Breakdown</CardTitle>
              <CardDescription>
                Distance traveled each day with site visit details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dailyDistances.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No distance data available for this month</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dailyDistances
                    .filter(day => day.totalDistance > 0)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((day) => (
                      <div key={day.date} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {format(new Date(day.date), 'EEEE, MMM dd')}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <Badge variant="outline">
                              {day.checkInCount} check-ins
                            </Badge>
                            <span className="font-semibold">
                              {day.totalDistance.toFixed(1)} km
                            </span>
                          </div>
                        </div>

                        {day.locations.length > 0 && (
                          <div className="space-y-2">
                            {day.locations.map((location, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span>{location.siteName}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {format(new Date(location.checkInTime), 'HH:mm')}
                                  </span>
                                  {location.distance && (
                                    <span className="text-muted-foreground">
                                      (+{location.distance.toFixed(1)} km)
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendar View */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Calendar</CardTitle>
              <CardDescription>
                Days with distance recorded
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
                {calendarDays.map(day => {
                  const dayData = dailyDistances.find(d => 
                    isSameDay(new Date(d.date), day)
                  )
                  const hasDistance = dayData && dayData.totalDistance > 0

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-2 rounded text-xs",
                        hasDistance 
                          ? "bg-blue-100 text-blue-800 font-medium" 
                          : "text-muted-foreground"
                      )}
                    >
                      {format(day, 'd')}
                      {hasDistance && (
                        <div className="text-[10px] mt-1">
                          {dayData.totalDistance.toFixed(0)}km
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Configuration Info */}
          {petrolConfig && (
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Rate per KM</p>
                  <p className="text-lg font-semibold">₹{petrolConfig.ratePerKm}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <Badge variant={petrolConfig.isActive ? 'default' : 'destructive'}>
                    {petrolConfig.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Last Updated</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(petrolConfig.updatedAt), 'PPp')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
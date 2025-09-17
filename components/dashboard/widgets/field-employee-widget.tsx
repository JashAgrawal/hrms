"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, Building2, Users, CheckCircle, AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { format } from "date-fns"

interface Site {
  id: string
  name: string
  code: string
  address: string
  city: string
  state: string
  siteType: string
}

interface ActiveSiteVisit {
  id: string
  checkInTime: string
  purpose?: string
  site: Site | null
  isValidLocation: boolean
}

interface FieldEmployeeData {
  assignedSitesCount: number
  activeSiteVisits: ActiveSiteVisit[]
  todayVisitsCount: number
  isFieldEmployee: boolean
}

export function FieldEmployeeWidget() {
  const [data, setData] = useState<FieldEmployeeData>({
    assignedSitesCount: 0,
    activeSiteVisits: [],
    todayVisitsCount: 0,
    isFieldEmployee: false
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFieldEmployeeData = async () => {
      try {
        // Check if user is a field employee and get their data
        const response = await fetch('/api/employees/field-data')
        if (response.ok) {
          const fieldData = await response.json()
          setData(fieldData)
        } else if (response.status === 404) {
          // User is not a field employee
          setData(prev => ({ ...prev, isFieldEmployee: false }))
        }
      } catch (error) {
        console.error('Failed to fetch field employee data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFieldEmployeeData()
  }, [])

  // Don't render if not a field employee
  if (!loading && !data.isFieldEmployee) {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Site Visits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-200 rounded w-24"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-primary" />
          Site Visits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3 text-blue-600" />
              <span className="text-xs text-muted-foreground">Assigned Sites</span>
            </div>
            <p className="text-lg font-semibold">{data.assignedSitesCount}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-green-600" />
              <span className="text-xs text-muted-foreground">Today's Visits</span>
            </div>
            <p className="text-lg font-semibold">{data.todayVisitsCount}</p>
          </div>
        </div>

        {/* Active Site Visits */}
        {data.activeSiteVisits.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Active Visits</span>
              <Badge variant="default" className="bg-green-100 text-green-800">
                {data.activeSiteVisits.length} Active
              </Badge>
            </div>
            
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {data.activeSiteVisits.map((visit) => (
                <div key={visit.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{visit.site?.name || 'Unknown Site'}</p>
                      <p className="text-xs text-muted-foreground">{visit.site?.code || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {visit.isValidLocation ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-orange-500" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      Checked in at {format(new Date(visit.checkInTime), 'HH:mm')}
                    </span>
                  </div>
                  
                  {visit.purpose && (
                    <p className="text-xs text-muted-foreground">
                      Purpose: {visit.purpose}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No active site visits</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t">
          <Button
            onClick={() => window.location.href = '/dashboard/attendance'}
            className="w-full h-10 text-sm font-medium"
            size="default"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Site Check-in
          </Button>
          
          <Button
            onClick={() => window.location.href = '/dashboard/sites'}
            variant="outline"
            className="w-full h-8 text-xs"
            size="sm"
          >
            View All Sites
          </Button>
        </div>

        {/* Quick Info */}
        <div className="pt-2 border-t text-center">
          <p className="text-xs text-muted-foreground">
            GPS tracking enabled • Location required
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
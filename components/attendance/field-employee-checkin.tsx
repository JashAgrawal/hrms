'use client'

import { useState, useEffect } from 'react'
import { MapPin, Clock, CheckCircle, AlertCircle, Loader2, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Site {
  id: string
  name: string
  code: string
  address: string
  city: string
  state: string
  latitude: number
  longitude: number
  radius: number
  siteType: string
  contactPerson?: string
  contactPhone?: string
}

interface EmployeeSite {
  id: string
  site: Site
}

interface ActiveSiteVisit {
  id: string
  checkInTime: string
  purpose?: string
  notes?: string
  site: Site
  distanceFromSite?: number
  isValidLocation: boolean
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number
  timestamp?: string
}

export function FieldEmployeeCheckin() {
  const [assignedSites, setAssignedSites] = useState<EmployeeSite[]>([])
  const [activeSiteVisits, setActiveSiteVisits] = useState<ActiveSiteVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [selectedSite, setSelectedSite] = useState<string>('')
  const [purpose, setPurpose] = useState('')
  const [notes, setNotes] = useState('')
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null)
  const [locationError, setLocationError] = useState<string>('')
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false)
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false)
  const [selectedVisitForCheckout, setSelectedVisitForCheckout] = useState<ActiveSiteVisit | null>(null)

  useEffect(() => {
    fetchAssignedSites()
    fetchActiveSiteVisits()
  }, [])

  const fetchAssignedSites = async () => {
    try {
      // Get current user's employee ID first
      const userResponse = await fetch('/api/auth/me')
      if (!userResponse.ok) throw new Error('Failed to get user info')
      
      const userData = await userResponse.json()
      if (!userData.employee) throw new Error('Employee record not found')

      const response = await fetch(`/api/employees/${userData.employee.id}/sites`)
      if (!response.ok) throw new Error('Failed to fetch assigned sites')

      const data = await response.json()
      setAssignedSites(data.employeeSites)
    } catch (error) {
      console.error('Error fetching assigned sites:', error)
    }
  }

  const fetchActiveSiteVisits = async () => {
    try {
      const response = await fetch('/api/site-visits/active')
      if (!response.ok) throw new Error('Failed to fetch active site visits')

      const data = await response.json()
      setActiveSiteVisits(data.activeSiteVisits)
    } catch (error) {
      console.error('Error fetching active site visits:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentLocation = (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          })
        },
        (error) => {
          reject(new Error(`Location error: ${error.message}`))
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      )
    })
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  const handleCheckIn = async () => {
    if (!selectedSite) {
      alert('Please select a site')
      return
    }

    try {
      setCheckingIn(true)
      setLocationError('')

      // Get current location
      const location = await getCurrentLocation()
      setCurrentLocation(location)

      // Find the selected site
      const site = assignedSites.find(es => es.site.id === selectedSite)?.site
      if (!site) {
        throw new Error('Selected site not found')
      }

      // Calculate distance
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        site.latitude,
        site.longitude
      )

      // Check if within radius
      const isWithinRadius = distance <= site.radius

      if (!isWithinRadius) {
        const confirmCheckIn = confirm(
          `You are ${Math.round(distance)}m away from the site (allowed: ${site.radius}m). Do you want to proceed with check-in?`
        )
        if (!confirmCheckIn) {
          setCheckingIn(false)
          return
        }
      }

      // Create site visit
      const response = await fetch('/api/site-visits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: selectedSite,
          checkInLocation: location,
          purpose,
          notes,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to check in')
      }

      const result = await response.json()
      
      // Reset form and refresh data
      setSelectedSite('')
      setPurpose('')
      setNotes('')
      setCheckInDialogOpen(false)
      fetchActiveSiteVisits()

      alert(result.message || 'Successfully checked in to site')
    } catch (error) {
      console.error('Error checking in:', error)
      setLocationError(error instanceof Error ? error.message : 'Failed to check in')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleCheckOut = async (visit: ActiveSiteVisit) => {
    try {
      setCheckingOut(true)
      setLocationError('')

      // Get current location
      const location = await getCurrentLocation()

      // Update site visit with check-out
      const response = await fetch(`/api/site-visits/${visit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkOutLocation: location,
          notes,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to check out')
      }

      // Reset and refresh
      setNotes('')
      setCheckOutDialogOpen(false)
      setSelectedVisitForCheckout(null)
      fetchActiveSiteVisits()

      alert('Successfully checked out from site')
    } catch (error) {
      console.error('Error checking out:', error)
      setLocationError(error instanceof Error ? error.message : 'Failed to check out')
    } finally {
      setCheckingOut(false)
    }
  }

  const openCheckOutDialog = (visit: ActiveSiteVisit) => {
    setSelectedVisitForCheckout(visit)
    setCheckOutDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Active Site Visits */}
      {activeSiteVisits.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Active Site Visits</h3>
          <div className="grid gap-4">
            {activeSiteVisits.map((visit) => (
              <Card key={visit.id} className="border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{visit.site.name}</CardTitle>
                      <p className="text-sm text-gray-600">{visit.site.code}</p>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Checked in at {new Date(visit.checkInTime).toLocaleTimeString()}</span>
                  </div>

                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p>{visit.site.address}</p>
                      <p>{visit.site.city}, {visit.site.state}</p>
                    </div>
                  </div>

                  {visit.purpose && (
                    <div className="text-sm">
                      <strong>Purpose:</strong> {visit.purpose}
                    </div>
                  )}

                  {visit.distanceFromSite !== undefined && (
                    <div className="flex items-center gap-2 text-sm">
                      {visit.isValidLocation ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      )}
                      <span>
                        Distance: {Math.round(visit.distanceFromSite)}m
                        {!visit.isValidLocation && ' (Outside radius)'}
                      </span>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      onClick={() => openCheckOutDialog(visit)}
                      variant="outline"
                      size="sm"
                    >
                      Check Out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Check-in Section */}
      <Card>
        <CardHeader>
          <CardTitle>Site Check-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignedSites.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No sites assigned to you</p>
              <p className="text-sm">Contact your manager to assign sites</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4">
                {assignedSites.map((employeeSite) => (
                  <Card key={employeeSite.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <h4 className="font-medium">{employeeSite.site.name}</h4>
                          <p className="text-sm text-gray-600">{employeeSite.site.code}</p>
                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p>{employeeSite.site.address}</p>
                              <p>{employeeSite.site.city}, {employeeSite.site.state}</p>
                            </div>
                          </div>
                          <Badge className="w-fit">
                            {employeeSite.site.siteType}
                          </Badge>
                        </div>
                        <Button
                          onClick={() => {
                            setSelectedSite(employeeSite.site.id)
                            setCheckInDialogOpen(true)
                          }}
                          disabled={activeSiteVisits.some(v => v.site.id === employeeSite.site.id)}
                        >
                          {activeSiteVisits.some(v => v.site.id === employeeSite.site.id)
                            ? 'Already Checked In'
                            : 'Check In'
                          }
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in Dialog */}
      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In to Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSite && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium">
                  {assignedSites.find(es => es.site.id === selectedSite)?.site.name}
                </h4>
                <p className="text-sm text-gray-600">
                  {assignedSites.find(es => es.site.id === selectedSite)?.site.address}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose of Visit (Optional)</Label>
              <Input
                id="purpose"
                placeholder="Enter purpose of visit"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Enter any additional notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {locationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{locationError}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setCheckInDialogOpen(false)}
                disabled={checkingIn}
              >
                Cancel
              </Button>
              <Button onClick={handleCheckIn} disabled={checkingIn}>
                {checkingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Check In
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Check-out Dialog */}
      <Dialog open={checkOutDialogOpen} onOpenChange={setCheckOutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out from Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedVisitForCheckout && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium">{selectedVisitForCheckout.site.name}</h4>
                <p className="text-sm text-gray-600">
                  Checked in at {new Date(selectedVisitForCheckout.checkInTime).toLocaleTimeString()}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="checkout-notes">Notes (Optional)</Label>
              <Textarea
                id="checkout-notes"
                placeholder="Enter any notes about your visit"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {locationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{locationError}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setCheckOutDialogOpen(false)}
                disabled={checkingOut}
              >
                Cancel
              </Button>
              <Button
                onClick={() => selectedVisitForCheckout && handleCheckOut(selectedVisitForCheckout)}
                disabled={checkingOut}
              >
                {checkingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking Out...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Check Out
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { MapPin, Plus, Trash2, Building2, Navigation, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface OfficeLocation {
  id: string
  name: string
  code: string
  address: string
  city: string
  state: string
  latitude: number
  longitude: number
  radius: number
}

interface EmployeeLocation {
  id?: string
  name: string
  latitude: number
  longitude: number
  radius: number
  isOfficeLocation: boolean
  officeLocationId?: string
}

interface LocationAssignmentFormProps {
  employeeId: string
  employeeName: string
  onSuccess?: () => void
}

export function LocationAssignmentForm({ employeeId, employeeName, onSuccess }: LocationAssignmentFormProps) {
  const [loading, setLoading] = useState(false)
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [assignedLocations, setAssignedLocations] = useState<EmployeeLocation[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Form state for new location
  const [newLocation, setNewLocation] = useState<EmployeeLocation>({
    name: '',
    latitude: 0,
    longitude: 0,
    radius: 100,
    isOfficeLocation: false
  })

  useEffect(() => {
    fetchOfficeLocations()
    fetchEmployeeLocations()
  }, [employeeId])

  const fetchOfficeLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      if (response.ok) {
        const data = await response.json()
        setOfficeLocations(data.officeLocations || [])
      }
    } catch (error) {
      console.error('Error fetching office locations:', error)
    }
  }

  const fetchEmployeeLocations = async () => {
    try {
      const response = await fetch(`/api/employees/${employeeId}/locations`)
      if (response.ok) {
        const data = await response.json()
        setAssignedLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching employee locations:', error)
    }
  }

  const handleAddOfficeLocation = (officeLocationId: string) => {
    const office = officeLocations.find(o => o.id === officeLocationId)
    if (!office) return

    if (assignedLocations.length >= 5) {
      toast.error('Maximum 5 locations can be assigned per employee')
      return
    }

    const newLoc: EmployeeLocation = {
      name: office.name,
      latitude: office.latitude,
      longitude: office.longitude,
      radius: office.radius,
      isOfficeLocation: true,
      officeLocationId: office.id
    }

    setAssignedLocations([...assignedLocations, newLoc])
    toast.success(`Added ${office.name} to assigned locations`)
  }

  const handleAddCustomLocation = () => {
    if (!newLocation.name || !newLocation.latitude || !newLocation.longitude) {
      toast.error('Please fill all required fields')
      return
    }

    if (assignedLocations.length >= 5) {
      toast.error('Maximum 5 locations can be assigned per employee')
      return
    }

    setAssignedLocations([...assignedLocations, { ...newLocation }])
    setNewLocation({
      name: '',
      latitude: 0,
      longitude: 0,
      radius: 100,
      isOfficeLocation: false
    })
    setIsDialogOpen(false)
    toast.success(`Added ${newLocation.name} to assigned locations`)
  }

  const handleRemoveLocation = (index: number) => {
    const location = assignedLocations[index]
    setAssignedLocations(assignedLocations.filter((_, i) => i !== index))
    toast.success(`Removed ${location.name} from assigned locations`)
  }

  const handleSaveAssignments = async () => {
    if (assignedLocations.length === 0) {
      toast.error('Please assign at least one location')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/employees/${employeeId}/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locations: assignedLocations
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Location assignments saved successfully')
        onSuccess?.()
      } else {
        toast.error(data.error || 'Failed to save location assignments')
      }
    } catch (error) {
      toast.error('Failed to save location assignments')
    } finally {
      setLoading(false)
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewLocation({
          ...newLocation,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
        toast.success('Current location captured')
      },
      (error) => {
        toast.error('Failed to get current location')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Assignment - {employeeName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Assignments */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Assigned Locations ({assignedLocations.length}/5)</h3>
            <Badge variant={assignedLocations.length === 0 ? 'destructive' : 'default'}>
              {assignedLocations.length === 0 ? 'No locations assigned' : `${assignedLocations.length} assigned`}
            </Badge>
          </div>

          {assignedLocations.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No locations assigned. Employee will not be able to check in until locations are assigned.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {assignedLocations.map((location, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {location.isOfficeLocation ? (
                      <Building2 className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Navigation className="h-4 w-4 text-green-600" />
                    )}
                    <div>
                      <div className="font-medium">{location.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} • {location.radius}m radius
                      </div>
                      <Badge variant="outline">
                        {location.isOfficeLocation ? 'Office Location' : 'Custom Location'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLocation(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Add Office Location */}
        <div>
          <h3 className="text-lg font-medium mb-4">Add Office Location</h3>
          <div className="flex gap-2">
            <Select onValueChange={handleAddOfficeLocation}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select an office location" />
              </SelectTrigger>
              <SelectContent>
                {officeLocations.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{office.name} - {office.city}, {office.state}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {officeLocations.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              No office locations available. Contact admin to add office locations.
            </p>
          )}
        </div>

        <Separator />

        {/* Add Custom Location */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Add Custom Location</h3>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Location
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Custom Location</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="location-name">Location Name *</Label>
                    <Input
                      id="location-name"
                      value={newLocation.name}
                      onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                      placeholder="e.g., Client Site, Home Office"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="latitude">Latitude *</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        value={newLocation.latitude || ''}
                        onChange={(e) => setNewLocation({ ...newLocation, latitude: parseFloat(e.target.value) || 0 })}
                        placeholder="28.6139"
                      />
                    </div>
                    <div>
                      <Label htmlFor="longitude">Longitude *</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        value={newLocation.longitude || ''}
                        onChange={(e) => setNewLocation({ ...newLocation, longitude: parseFloat(e.target.value) || 0 })}
                        placeholder="77.2090"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="radius">Radius (meters)</Label>
                    <Input
                      id="radius"
                      type="number"
                      value={newLocation.radius}
                      onChange={(e) => setNewLocation({ ...newLocation, radius: parseInt(e.target.value) || 100 })}
                      placeholder="100"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    className="w-full"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Use Current Location
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddCustomLocation}
                      className="flex-1"
                    >
                      Add Location
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Separator />

        {/* Save Button */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSaveAssignments}
            disabled={loading || assignedLocations.length === 0}
            className="min-w-32"
          >
            {loading ? 'Saving...' : 'Save Assignments'}
          </Button>
        </div>

        {/* Guidelines */}
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Location Assignment Guidelines:</p>
              <ul className="text-xs space-y-1 ml-4 list-disc">
                <li>Each employee can have up to 5 assigned locations</li>
                <li>Office locations are predefined and managed by admin</li>
                <li>Custom locations can be added for client sites or remote work</li>
                <li>Radius determines the geo-fence area for attendance validation</li>
                <li>Employees can only check in from assigned locations</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
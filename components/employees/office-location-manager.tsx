'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Building2, Plus, Edit, Trash2, MapPin, Navigation, AlertTriangle } from 'lucide-react'
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
  timezone: string
  isActive: boolean
}

interface OfficeLocationFormData {
  name: string
  code: string
  address: string
  city: string
  state: string
  latitude: number
  longitude: number
  radius: number
  timezone: string
}

export function OfficeLocationManager() {
  const [loading, setLoading] = useState(false)
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<OfficeLocation | null>(null)
  
  const [formData, setFormData] = useState<OfficeLocationFormData>({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    latitude: 0,
    longitude: 0,
    radius: 100,
    timezone: 'Asia/Kolkata'
  })

  useEffect(() => {
    fetchOfficeLocations()
  }, [])

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

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      latitude: 0,
      longitude: 0,
      radius: 100,
      timezone: 'Asia/Kolkata'
    })
    setEditingLocation(null)
  }

  const handleOpenDialog = (location?: OfficeLocation) => {
    if (location) {
      setEditingLocation(location)
      setFormData({
        name: location.name,
        code: location.code,
        address: location.address,
        city: location.city,
        state: location.state,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: location.radius,
        timezone: location.timezone
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    resetForm()
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.code || !formData.address || !formData.city || !formData.state) {
      toast.error('Please fill all required fields')
      return
    }

    if (!formData.latitude || !formData.longitude) {
      toast.error('Please provide valid coordinates')
      return
    }

    setLoading(true)
    try {
      const url = editingLocation 
        ? `/api/locations/${editingLocation.id}`
        : '/api/locations'
      
      const method = editingLocation ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(editingLocation ? 'Office location updated successfully' : 'Office location created successfully')
        handleCloseDialog()
        fetchOfficeLocations()
      } else {
        toast.error(data.error || 'Failed to save office location')
      }
    } catch (error) {
      toast.error('Failed to save office location')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (location: OfficeLocation) => {
    if (!confirm(`Are you sure you want to delete "${location.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/locations/${location.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Office location deleted successfully')
        fetchOfficeLocations()
      } else {
        toast.error(data.error || 'Failed to delete office location')
      }
    } catch (error) {
      toast.error('Failed to delete office location')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Office Location Management
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Office Location
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingLocation ? 'Edit Office Location' : 'Add New Office Location'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Office Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Delhi Head Office"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="code">Office Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., DEL"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Complete office address"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g., Delhi"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="e.g., Delhi"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="latitude">Latitude *</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={formData.latitude || ''}
                      onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                      placeholder="28.6139"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="longitude">Longitude *</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={formData.longitude || ''}
                      onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                      placeholder="77.2090"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="radius">Geo-fence Radius (meters)</Label>
                    <Input
                      id="radius"
                      type="number"
                      value={formData.radius}
                      onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) || 100 })}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      placeholder="Asia/Kolkata"
                    />
                  </div>
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
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? 'Saving...' : editingLocation ? 'Update Location' : 'Create Location'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {officeLocations.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No office locations configured. Add office locations to enable location-based attendance.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Office</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Radius</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {officeLocations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{location.name}</div>
                        <div className="text-sm text-muted-foreground">{location.code}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{location.address}</div>
                        <div className="text-xs text-muted-foreground">
                          {location.city}, {location.state}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-mono">
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{location.radius}m</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={location.isActive ? 'default' : 'secondary'}>
                        {location.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(location)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(location)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Guidelines */}
        <Alert className="mt-6">
          <MapPin className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Office Location Guidelines:</p>
              <ul className="text-xs space-y-1 ml-4 list-disc">
                <li>Office locations are predefined locations that can be assigned to employees</li>
                <li>Use accurate GPS coordinates for precise geo-fencing</li>
                <li>Radius determines the check-in area around the office</li>
                <li>Recommended radius: 50-200 meters depending on office size</li>
                <li>Office codes should be unique and easy to identify</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
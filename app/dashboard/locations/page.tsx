'use client'

import { useState, useEffect } from 'react'
import { 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Settings,
  Search,
  Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface Location {
  id: string
  name: string
  address?: string
  latitude: number
  longitude: number
  radius: number
  isActive: boolean
  timezone: string
  workingHours?: any
  createdAt: string
  updatedAt: string
  _count: {
    employeeLocations: number
  }
}

interface LocationFormData {
  name: string
  address: string
  latitude: number
  longitude: number
  radius: number
  timezone: string
  workingHours?: any
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    radius: 100,
    timezone: 'Asia/Kolkata',
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/locations')
      
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations)
      } else {
        throw new Error('Failed to fetch locations')
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      toast({
        title: "Error",
        description: "Failed to fetch locations",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLocation = async () => {
    try {
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Location created successfully",
        })
        setShowCreateDialog(false)
        resetForm()
        fetchLocations()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create location')
      }
    } catch (error) {
      console.error('Error creating location:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create location",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      latitude: 0,
      longitude: 0,
      radius: 100,
      timezone: 'Asia/Kolkata',
    })
    setEditingLocation(null)
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }))
          toast({
            title: "Location Updated",
            description: "Current location coordinates have been set",
          })
        },
        (error) => {
          console.error('Error getting location:', error)
          toast({
            title: "Location Error",
            description: "Could not get current location. Please enter coordinates manually.",
            variant: "destructive",
          })
        }
      )
    } else {
      toast({
        title: "Not Supported",
        description: "Geolocation is not supported by this browser",
        variant: "destructive",
      })
    }
  }

  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-8 w-8 text-blue-600" />
            Locations
          </h1>
          <p className="text-muted-foreground">
            Manage work locations and geo-fencing settings
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Main Office, Branch Office"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  placeholder="Full address of the location"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    placeholder="0.000000"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    placeholder="0.000000"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={getCurrentLocation}
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Use Current Location
              </Button>
              
              <div className="space-y-2">
                <Label htmlFor="radius">Radius (meters)</Label>
                <Input
                  id="radius"
                  type="number"
                  placeholder="100"
                  value={formData.radius}
                  onChange={(e) => setFormData(prev => ({ ...prev, radius: parseInt(e.target.value) || 100 }))}
                />
                <p className="text-xs text-gray-500">
                  Employees must be within this radius to check in
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false)
                    resetForm()
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateLocation}
                  className="flex-1"
                  disabled={!formData.name || !formData.latitude || !formData.longitude}
                >
                  Create Location
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Locations Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          filteredLocations.map((location) => (
            <Card key={location.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      {location.name}
                    </CardTitle>
                    {location.address && (
                      <p className="text-sm text-gray-600 mt-1">{location.address}</p>
                    )}
                  </div>
                  <Badge variant={location.isActive ? "default" : "secondary"}>
                    {location.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Coordinates:</span>
                    <p className="font-mono text-xs">
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Radius:</span>
                    <p>{location.radius}m</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    {location._count.employeeLocations} employees assigned
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <Button variant="outline" className="w-full" size="sm">
                  View on Map
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {filteredLocations.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No locations found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'No locations match your search criteria.' : 'Get started by creating your first work location.'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
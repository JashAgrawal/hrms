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
  Filter,
  UserPlus,
  X
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
  code: string
  address: string
  city: string
  state: string
  latitude: number
  longitude: number
  radius: number
  timezone: string
  workingHours?: any
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  designation: string
  department: {
    name: string
  }
}

interface EmployeeLocation {
  id: string
  employee: Employee
  isActive: boolean
  assignedAt: string
  assignedBy: string
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [assignedEmployees, setAssignedEmployees] = useState<EmployeeLocation[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
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
        // Use officeLocations from API response and normalize numeric fields
        const normalized = (data.officeLocations || []).map((loc: any) => ({
          ...loc,
          latitude: typeof loc?.latitude === 'string' ? parseFloat(loc.latitude) : loc?.latitude ?? 0,
          longitude: typeof loc?.longitude === 'string' ? parseFloat(loc.longitude) : loc?.longitude ?? 0,
          radius: typeof loc?.radius === 'string' ? parseInt(loc.radius, 10) : loc?.radius ?? 0,
        }))
        setLocations(normalized)
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
      code: '',
      address: '',
      city: '',
      state: '',
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

  const formatCoordinate = (value: unknown) => {
    const numberValue = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN
    return Number.isFinite(numberValue) ? numberValue.toFixed(6) : 'N/A'
  }

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true)
      const response = await fetch('/api/employees')
      
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      } else {
        throw new Error('Failed to fetch employees')
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast({
        title: "Error",
        description: "Failed to fetch employees",
        variant: "destructive",
      })
    } finally {
      setLoadingEmployees(false)
    }
  }

  const fetchAssignedEmployees = async (locationId: string) => {
    try {
      setLoadingEmployees(true)
      const response = await fetch(`/api/locations/${locationId}/employees`)
      
      if (response.ok) {
        const data = await response.json()
        setAssignedEmployees(data.employees || [])
      } else {
        throw new Error('Failed to fetch assigned employees')
      }
    } catch (error) {
      console.error('Error fetching assigned employees:', error)
      toast({
        title: "Error",
        description: "Failed to fetch assigned employees",
        variant: "destructive",
      })
    } finally {
      setLoadingEmployees(false)
    }
  }

  const handleOpenAssignDialog = (location: Location) => {
    setSelectedLocation(location)
    setSelectedEmployees([])
    setShowAssignDialog(true)
    fetchEmployees()
    fetchAssignedEmployees(location.id)
  }

  const handleToggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const handleAssignEmployees = async () => {
    if (!selectedLocation) return
    
    try {
      const response = await fetch(`/api/locations/${selectedLocation.id}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeIds: selectedEmployees,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Employees assigned successfully",
        })
        setShowAssignDialog(false)
        fetchLocations() // Refresh the locations to update the employee count
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign employees')
      }
    } catch (error) {
      console.error('Error assigning employees:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign employees",
        variant: "destructive",
      })
    }
  }

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
              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="code">Location Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., HO, BO1"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  />
                </div>
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
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="e.g., Mumbai, Delhi"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="e.g., Maharashtra, Delhi"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  />
                </div>
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
                  disabled={!formData.name || !formData.code || !formData.city || !formData.state || !formData.latitude || !formData.longitude}
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
                      {formatCoordinate(location.latitude)}, {formatCoordinate(location.longitude)}
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
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleOpenAssignDialog(location)}
                      title="Assign Employees"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
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

      {/* Employee Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Employees to {selectedLocation?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Currently Assigned Employees */}
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Currently Assigned ({assignedEmployees.length})</h4>
              {assignedEmployees.length === 0 ? (
                <p className="text-sm text-gray-500">No employees assigned to this location yet.</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {assignedEmployees.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">
                          {assignment.employee.firstName} {assignment.employee.lastName}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          ({assignment.employee.employeeCode})
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700"
                        onClick={async () => {
                          // Handle remove assignment
                          try {
                            const response = await fetch(`/api/locations/${selectedLocation?.id}/employees/${assignment.employee.id}`, {
                              method: 'DELETE'
                            })
                            if (response.ok) {
                              fetchAssignedEmployees(selectedLocation!.id)
                              fetchLocations()
                              toast({
                                title: "Success",
                                description: "Employee removed from location",
                              })
                            }
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: "Failed to remove employee",
                              variant: "destructive",
                            })
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available Employees */}
            <div className="flex-1 min-h-0">
              <h4 className="text-sm font-medium mb-2">Available Employees</h4>
              
              {loadingEmployees ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="border rounded-md max-h-64 overflow-y-auto">
                  {employees
                    .filter(emp => !assignedEmployees.some(assigned => assigned.employee.id === emp.id))
                    .map((employee) => (
                    <label
                      key={employee.id}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(employee.id)}
                        onChange={() => handleToggleEmployeeSelection(employee.id)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {employee.employeeCode} • {employee.designation}
                        </div>
                        <div className="text-xs text-gray-400">
                          {employee.department.name}
                        </div>
                      </div>
                    </label>
                  ))}
                  
                  {employees.filter(emp => !assignedEmployees.some(assigned => assigned.employee.id === emp.id)).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      All employees are already assigned to this location
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-gray-500">
              {selectedEmployees.length} employee(s) selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAssignDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignEmployees}
                disabled={selectedEmployees.length === 0}
              >
                Assign Selected
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

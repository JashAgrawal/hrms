'use client'

import { useState, useEffect } from 'react'
import { MapPin, Users, Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

interface Site {
  id: string
  name: string
  code: string
  address: string
  city: string
  state: string
  siteType: string
  latitude: number
  longitude: number
  radius: number
  contactPerson?: string
  contactPhone?: string
}

interface EmployeeSite {
  id: string
  site: Site
  assignedAt: string
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  employeeType: string
}

interface EmployeeSiteAssignmentProps {
  employee: Employee
}

const siteTypeColors = {
  CLIENT: 'bg-blue-100 text-blue-800',
  VENDOR: 'bg-green-100 text-green-800',
  PARTNER: 'bg-purple-100 text-purple-800',
  WAREHOUSE: 'bg-orange-100 text-orange-800',
  OFFICE: 'bg-gray-100 text-gray-800',
  OTHER: 'bg-yellow-100 text-yellow-800',
}

export function EmployeeSiteAssignment({ employee }: EmployeeSiteAssignmentProps) {
  const [assignedSites, setAssignedSites] = useState<EmployeeSite[]>([])
  const [availableSites, setAvailableSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (employee.employeeType === 'FIELD_EMPLOYEE') {
      fetchAssignedSites()
      fetchAvailableSites()
    } else {
      setLoading(false)
    }
  }, [employee])

  const fetchAssignedSites = async () => {
    try {
      const response = await fetch(`/api/employees/${employee.id}/sites`)
      if (!response.ok) throw new Error('Failed to fetch assigned sites')

      const data = await response.json()
      setAssignedSites(data.employeeSites)
    } catch (error) {
      console.error('Error fetching assigned sites:', error)
    }
  }

  const fetchAvailableSites = async () => {
    try {
      const response = await fetch('/api/sites?limit=100&isActive=true')
      if (!response.ok) throw new Error('Failed to fetch available sites')

      const data = await response.json()
      setAvailableSites(data.sites)
    } catch (error) {
      console.error('Error fetching available sites:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignSites = async () => {
    if (selectedSiteIds.length === 0) {
      alert('Please select at least one site')
      return
    }

    try {
      setAssigning(true)

      const response = await fetch(`/api/employees/${employee.id}/sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteIds: selectedSiteIds,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign sites')
      }

      // Refresh assigned sites
      await fetchAssignedSites()
      
      // Reset and close dialog
      setSelectedSiteIds([])
      setAssignDialogOpen(false)
      
      alert('Sites assigned successfully')
    } catch (error) {
      console.error('Error assigning sites:', error)
      alert(error instanceof Error ? error.message : 'Failed to assign sites')
    } finally {
      setAssigning(false)
    }
  }

  const handleSiteSelection = (siteId: string, checked: boolean) => {
    if (checked) {
      setSelectedSiteIds(prev => [...prev, siteId])
    } else {
      setSelectedSiteIds(prev => prev.filter(id => id !== siteId))
    }
  }

  const filteredAvailableSites = availableSites.filter(site =>
    site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.city.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (employee.employeeType !== 'FIELD_EMPLOYEE') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Site Assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Site assignment is only available for field employees</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Assigned Sites ({assignedSites.length})
            </CardTitle>
            <Button onClick={() => setAssignDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Assign Sites
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {assignedSites.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No sites assigned to this employee</p>
              <p className="text-sm">Click "Assign Sites" to get started</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {assignedSites.map((employeeSite) => (
                <Card key={employeeSite.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{employeeSite.site.name}</h4>
                          <Badge
                            className={siteTypeColors[employeeSite.site.siteType as keyof typeof siteTypeColors]}
                          >
                            {employeeSite.site.siteType}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{employeeSite.site.code}</p>
                        <div className="flex items-start gap-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p>{employeeSite.site.address}</p>
                            <p>{employeeSite.site.city}, {employeeSite.site.state}</p>
                          </div>
                        </div>
                        {employeeSite.site.contactPerson && (
                          <div className="text-sm text-gray-600">
                            <p><strong>Contact:</strong> {employeeSite.site.contactPerson}</p>
                            {employeeSite.site.contactPhone && <p>{employeeSite.site.contactPhone}</p>}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Assigned on {new Date(employeeSite.assignedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Radius: {employeeSite.site.radius}m
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Site Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Sites to {employee.firstName} {employee.lastName}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search sites..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <div className="text-sm text-gray-600">
                {selectedSiteIds.length} selected
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid gap-3">
                {filteredAvailableSites.map((site) => {
                  const isAssigned = assignedSites.some(es => es.site.id === site.id)
                  const isSelected = selectedSiteIds.includes(site.id)
                  
                  return (
                    <Card
                      key={site.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'ring-2 ring-blue-500' : ''
                      } ${isAssigned ? 'opacity-50' : ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => 
                              handleSiteSelection(site.id, checked as boolean)
                            }
                            disabled={isAssigned}
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{site.name}</h4>
                              <Badge
                                className={siteTypeColors[site.siteType as keyof typeof siteTypeColors]}
                              >
                                {site.siteType}
                              </Badge>
                              {isAssigned && (
                                <Badge variant="secondary">Already Assigned</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{site.code}</p>
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <p>{site.address}</p>
                                <p>{site.city}, {site.state}</p>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              Radius: {site.radius}m
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setAssignDialogOpen(false)}
                disabled={assigning}
              >
                Cancel
              </Button>
              <Button onClick={handleAssignSites} disabled={assigning || selectedSiteIds.length === 0}>
                {assigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  `Assign ${selectedSiteIds.length} Site${selectedSiteIds.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
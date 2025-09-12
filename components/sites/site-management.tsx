'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, MapPin, Users, Calendar, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreateSiteDialog } from './create-site-dialog'
import { EditSiteDialog } from './edit-site-dialog'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

interface Site {
  id: string
  name: string
  code: string
  address: string
  city: string
  state: string
  country: string
  latitude: number
  longitude: number
  radius: number
  siteType: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  description?: string
  isActive: boolean
  _count: {
    siteVisits: number
    employeeSites: number
  }
}

const siteTypeColors = {
  CLIENT: 'bg-blue-100 text-blue-800',
  VENDOR: 'bg-green-100 text-green-800',
  PARTNER: 'bg-purple-100 text-purple-800',
  WAREHOUSE: 'bg-orange-100 text-orange-800',
  OFFICE: 'bg-gray-100 text-gray-800',
  OTHER: 'bg-yellow-100 text-yellow-800',
}

export function SiteManagement() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [siteTypeFilter, setSiteTypeFilter] = useState<string>('')
  const [cityFilter, setCityFilter] = useState('')
  const [isActiveFilter, setIsActiveFilter] = useState<string>('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })

  const fetchSites = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(siteTypeFilter && { siteType: siteTypeFilter }),
        ...(cityFilter && { city: cityFilter }),
        ...(isActiveFilter && { isActive: isActiveFilter }),
      })

      const response = await fetch(`/api/sites?${params}`)
      if (!response.ok) throw new Error('Failed to fetch sites')

      const data = await response.json()
      setSites(data.sites)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching sites:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSites()
  }, [pagination.page, searchTerm, siteTypeFilter, cityFilter, isActiveFilter])

  const handleCreateSite = () => {
    setCreateDialogOpen(false)
    fetchSites()
  }

  const handleEditSite = (site: Site) => {
    setSelectedSite(site)
    setEditDialogOpen(true)
  }

  const handleUpdateSite = () => {
    setEditDialogOpen(false)
    setSelectedSite(null)
    fetchSites()
  }

  const handleDeleteSite = async (siteId: string) => {
    if (!confirm('Are you sure you want to delete this site?')) return

    try {
      const response = await fetch(`/api/sites/${siteId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete site')

      fetchSites()
    } catch (error) {
      console.error('Error deleting site:', error)
    }
  }

  if (loading && sites.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search sites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={siteTypeFilter} onValueChange={setSiteTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Site Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="CLIENT">Client</SelectItem>
              <SelectItem value="VENDOR">Vendor</SelectItem>
              <SelectItem value="PARTNER">Partner</SelectItem>
              <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
              <SelectItem value="OFFICE">Office</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Filter by city"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-40"
          />

          <Select value={isActiveFilter} onValueChange={setIsActiveFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Site
        </Button>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites.map((site) => (
          <Card key={site.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{site.name}</CardTitle>
                  <p className="text-sm text-gray-600">{site.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={siteTypeColors[site.siteType as keyof typeof siteTypeColors]}
                  >
                    {site.siteType}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditSite(site)}>
                        Edit Site
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteSite(site.id)}
                        className="text-red-600"
                      >
                        Delete Site
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-600">
                  <p>{site.address}</p>
                  <p>{site.city}, {site.state}</p>
                </div>
              </div>

              {site.contactPerson && (
                <div className="text-sm text-gray-600">
                  <p><strong>Contact:</strong> {site.contactPerson}</p>
                  {site.contactPhone && <p>{site.contactPhone}</p>}
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{site._count.employeeSites} employees</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{site._count.siteVisits} visits</span>
                  </div>
                </div>
                <Badge variant={site.isActive ? 'default' : 'secondary'}>
                  {site.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="text-xs text-gray-500">
                Radius: {site.radius}m
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sites.length === 0 && !loading && (
        <div className="text-center py-12">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sites found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || siteTypeFilter || cityFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first site'}
          </p>
          {!searchTerm && !siteTypeFilter && !cityFilter && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Site
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} sites
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateSiteDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSite}
      />

      {selectedSite && (
        <EditSiteDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          site={selectedSite}
          onSuccess={handleUpdateSite}
        />
      )}
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Search, MapPin, Clock, Users, Calendar, Filter, CheckCircle, AlertCircle } from 'lucide-react'
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
import { LoadingSpinner } from '@/components/shared/loading-spinner'

interface SiteVisit {
  id: string
  date: string
  checkInTime: string
  checkOutTime?: string
  purpose?: string
  notes?: string
  status: string
  distanceFromSite?: number
  isValidLocation: boolean
  duration?: number
  locationName?: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
  }
  site?: {
    id: string
    name: string
    code: string
    address: string
    city: string
    siteType: string
  } | null
}

const statusColors = {
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  MISSED: 'bg-gray-100 text-gray-800',
}

const siteTypeColors = {
  CLIENT: 'bg-blue-100 text-blue-800',
  VENDOR: 'bg-green-100 text-green-800',
  PARTNER: 'bg-purple-100 text-purple-800',
  WAREHOUSE: 'bg-orange-100 text-orange-800',
  OFFICE: 'bg-gray-100 text-gray-800',
  LOCATION_BASED: 'bg-indigo-100 text-indigo-800',
  OTHER: 'bg-yellow-100 text-yellow-800',
}

export function SiteVisitsDashboard() {
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFilter, setDateFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  })

  const fetchSiteVisits = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(statusFilter && { status: statusFilter }),
        ...(dateFilter && { date: dateFilter }),
        ...(employeeFilter && { employeeId: employeeFilter }),
        ...(siteFilter && { siteId: siteFilter }),
      })

      const response = await fetch(`/api/site-visits?${params}`)
      if (!response.ok) throw new Error('Failed to fetch site visits')

      const data = await response.json()
      setSiteVisits(data.siteVisits)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching site visits:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSiteVisits()
  }, [pagination.page, statusFilter, dateFilter, employeeFilter, siteFilter])

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 text-blue-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  if (loading && siteVisits.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="MISSED">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search employees, sites..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('')
                  setDateFilter('')
                  setSearchTerm('')
                  setEmployeeFilter('')
                  setSiteFilter('')
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Site Visits List */}
      <div className="space-y-4">
        {siteVisits.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No site visits found</h3>
              <p className="text-gray-600">
                {statusFilter || dateFilter || searchTerm
                  ? 'Try adjusting your filters'
                  : 'Site visits will appear here once field employees start checking in'}
              </p>
            </CardContent>
          </Card>
        ) : (
          siteVisits
            .filter(visit => {
              if (!searchTerm) return true
              const searchLower = searchTerm.toLowerCase()
              return (
                visit.employee.firstName.toLowerCase().includes(searchLower) ||
                visit.employee.lastName.toLowerCase().includes(searchLower) ||
                visit.employee.employeeCode.toLowerCase().includes(searchLower) ||
                (visit.site?.name?.toLowerCase().includes(searchLower)) ||
                (visit.site?.code?.toLowerCase().includes(searchLower)) ||
                (visit.site?.city?.toLowerCase().includes(searchLower)) ||
                (visit.locationName?.toLowerCase().includes(searchLower))
              )
            })
            .map((visit) => (
              <Card key={visit.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">
                              {visit.employee.firstName} {visit.employee.lastName}
                            </h3>
                            <Badge variant="outline">{visit.employee.employeeCode}</Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">
                              {visit.site?.name || visit.locationName || 'Unknown Location'}
                            </span>
                            <Badge
                              className={siteTypeColors[(visit.site?.siteType || 'LOCATION_BASED') as keyof typeof siteTypeColors]}
                            >
                              {visit.site?.siteType || 'LOCATION_BASED'}
                            </Badge>
                          </div>

                          {visit.site ? (
                            <p className="text-sm text-gray-600 mb-3">
                              {visit.site.address}, {visit.site.city}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-600 mb-3">
                              Custom location visit
                            </p>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span>{new Date(visit.date).toLocaleDateString()}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span>
                                {new Date(visit.checkInTime).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                                {visit.checkOutTime && (
                                  <> - {new Date(visit.checkOutTime).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}</>
                                )}
                              </span>
                            </div>

                            {visit.duration && (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-500" />
                                <span>Duration: {formatDuration(visit.duration)}</span>
                              </div>
                            )}

                            {visit.distanceFromSite !== undefined && visit.site && (
                              <div className="flex items-center gap-2">
                                {visit.isValidLocation ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-orange-500" />
                                )}
                                <span>
                                  {Math.round(visit.distanceFromSite)}m
                                  {!visit.isValidLocation && ' (Outside radius)'}
                                </span>
                              </div>
                            )}

                            {!visit.site && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-indigo-500" />
                                <span className="text-indigo-600">Location-based visit</span>
                              </div>
                            )}
                          </div>

                          {visit.purpose && (
                            <div className="mt-3 p-2 bg-gray-50 rounded">
                              <p className="text-sm"><strong>Purpose:</strong> {visit.purpose}</p>
                            </div>
                          )}

                          {visit.notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded">
                              <p className="text-sm"><strong>Notes:</strong> {visit.notes}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(visit.status)}
                            <Badge
                              className={statusColors[visit.status as keyof typeof statusColors]}
                            >
                              {visit.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} site visits
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
    </div>
  )
}
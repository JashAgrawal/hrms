'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  DollarSign,
  MapPin
} from 'lucide-react'

interface Department {
  id: string
  name: string
  code: string
  _count: {
    employees: number
  }
}

interface AdvancedSearchProps {
  departments: Department[]
}

export function EmployeeAdvancedSearch({ departments }: AdvancedSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isExpanded, setIsExpanded] = useState(false)

  // Get current filter values
  const currentFilters = {
    search: searchParams.get('search') || '',
    department: searchParams.get('department') || '',
    status: searchParams.get('status') || '',
    employmentType: searchParams.get('employmentType') || '',
    joiningDateFrom: searchParams.get('joiningDateFrom') || '',
    joiningDateTo: searchParams.get('joiningDateTo') || '',
    salaryMin: searchParams.get('salaryMin') || '',
    salaryMax: searchParams.get('salaryMax') || '',
    designation: searchParams.get('designation') || '',
    location: searchParams.get('location') || '',
  }

  // Local state for form inputs
  const [filters, setFilters] = useState(currentFilters)

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const applyFilters = () => {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      }
    })
    
    // Reset to page 1 when filters change
    params.set('page', '1')
    
    router.push(`/dashboard/employees?${params.toString()}`)
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      department: '',
      status: '',
      employmentType: '',
      joiningDateFrom: '',
      joiningDateTo: '',
      salaryMin: '',
      salaryMax: '',
      designation: '',
      location: '',
    })
    router.push('/dashboard/employees')
  }

  const activeFiltersCount = Object.values(currentFilters).filter(Boolean).length
  const hasActiveFilters = activeFiltersCount > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Employee Search
            </CardTitle>
            <CardDescription>
              Search and filter employees with advanced criteria
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Badge variant="secondary">
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active
              </Badge>
            )}
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Advanced
                  {isExpanded ? (
                    <ChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-2 h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name, email, employee code, or designation..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyFilters()
                }
              }}
            />
          </div>
          <Button onClick={applyFilters}>
            Search
          </Button>
          {hasActiveFilters && (
            <Button onClick={clearFilters} variant="outline">
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={filters.department} onValueChange={(value) => updateFilter('department', value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name} ({dept._count.employees})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="ON_LEAVE">On Leave</SelectItem>
              <SelectItem value="TERMINATED">Terminated</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.employmentType} onValueChange={(value) => updateFilter('employmentType', value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All types</SelectItem>
              <SelectItem value="FULL_TIME">Full Time</SelectItem>
              <SelectItem value="PART_TIME">Part Time</SelectItem>
              <SelectItem value="CONTRACT">Contract</SelectItem>
              <SelectItem value="INTERN">Intern</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Filters */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Joining Date Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Joining Date Range
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    placeholder="From"
                    value={filters.joiningDateFrom}
                    onChange={(e) => updateFilter('joiningDateFrom', e.target.value)}
                  />
                  <Input
                    type="date"
                    placeholder="To"
                    value={filters.joiningDateTo}
                    onChange={(e) => updateFilter('joiningDateTo', e.target.value)}
                  />
                </div>
              </div>

              {/* Salary Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Salary Range (CTC)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.salaryMin}
                    onChange={(e) => updateFilter('salaryMin', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.salaryMax}
                    onChange={(e) => updateFilter('salaryMax', e.target.value)}
                  />
                </div>
              </div>

              {/* Designation */}
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input
                  placeholder="e.g. Manager, Developer"
                  value={filters.designation}
                  onChange={(e) => updateFilter('designation', e.target.value)}
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </Label>
                <Input
                  placeholder="e.g. Mumbai, Bangalore"
                  value={filters.location}
                  onChange={(e) => updateFilter('location', e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Use advanced filters to narrow down your search results
              </div>
              <div className="flex gap-2">
                <Button onClick={applyFilters}>
                  Apply Filters
                </Button>
                <Button onClick={clearFilters} variant="outline">
                  Reset All
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
            {Object.entries(currentFilters).map(([key, value]) => {
              if (!value) return null
              
              let displayValue = value
              if (key === 'department') {
                const dept = departments.find(d => d.id === value)
                displayValue = dept ? dept.name : value
              } else if (key === 'status' || key === 'employmentType') {
                displayValue = value.replace('_', ' ')
              }
              
              return (
                <Badge key={key} variant="secondary" className="gap-1">
                  {key === 'search' ? 'Search' : 
                   key === 'joiningDateFrom' ? 'From' :
                   key === 'joiningDateTo' ? 'To' :
                   key === 'salaryMin' ? 'Min Salary' :
                   key === 'salaryMax' ? 'Max Salary' :
                   key.charAt(0).toUpperCase() + key.slice(1)}: {displayValue}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => {
                      const newFilters = { ...filters, [key]: '' }
                      setFilters(newFilters)
                      
                      const params = new URLSearchParams()
                      Object.entries(newFilters).forEach(([k, v]) => {
                        if (v) params.set(k, v)
                      })
                      params.set('page', '1')
                      router.push(`/dashboard/employees?${params.toString()}`)
                    }}
                  />
                </Badge>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
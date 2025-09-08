'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Filter, X } from 'lucide-react'

interface Department {
  id: string
  name: string
  code: string
  _count: {
    employees: number
  }
}

export function EmployeeFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  // Get current filter values
  const currentSearch = searchParams.get('search') || ''
  const currentDepartment = searchParams.get('department') || ''
  const currentStatus = searchParams.get('status') || ''
  const currentEmploymentType = searchParams.get('employmentType') || ''

  // Local state for form inputs
  const [search, setSearch] = useState(currentSearch)
  const [department, setDepartment] = useState(currentDepartment)
  const [status, setStatus] = useState(currentStatus)
  const [employmentType, setEmploymentType] = useState(currentEmploymentType)

  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments')
      if (response.ok) {
        const result = await response.json()
        setDepartments(result.departments)
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateFilters = (newFilters: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    
    // Update or remove parameters
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    
    // Reset to page 1 when filters change
    params.set('page', '1')
    
    router.push(`/dashboard/employees?${params.toString()}`)
  }

  const handleSearch = () => {
    updateFilters({
      search,
      department,
      status,
      employmentType,
    })
  }

  const clearFilters = () => {
    setSearch('')
    setDepartment('')
    setStatus('')
    setEmploymentType('')
    router.push('/dashboard/employees')
  }

  const hasActiveFilters = currentSearch || currentDepartment || currentStatus || currentEmploymentType

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, email, employee code, or designation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
              />
            </div>
            <Button onClick={handleSearch}>
              <Filter className="mr-2 h-4 w-4" />
              Search
            </Button>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline">
                <X className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Department</label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
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
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  <SelectItem value="TERMINATED">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Employment Type</label>
              <Select value={employmentType} onValueChange={setEmploymentType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
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
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button onClick={handleSearch} size="sm">
                Apply Filters
              </Button>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline" size="sm">
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
            
            {hasActiveFilters && (
              <div className="text-sm text-muted-foreground">
                {[
                  currentSearch && `Search: "${currentSearch}"`,
                  currentDepartment && departments.find(d => d.id === currentDepartment)?.name,
                  currentStatus && `Status: ${currentStatus.replace('_', ' ')}`,
                  currentEmploymentType && `Type: ${currentEmploymentType.replace('_', ' ')}`,
                ].filter(Boolean).join(' • ')}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
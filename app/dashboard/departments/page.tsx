'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Building2, Plus, Search, Users, Edit, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Department {
  id: string
  name: string
  description?: string
  headId?: string
  head?: {
    firstName: string
    lastName: string
  }
  _count?: {
    employees: number
  }
  createdAt: string
}

export default function DepartmentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [departments, setDepartments] = useState<Department[]>([])
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  useEffect(() => {
    // Handle redirects for authentication and authorization
    if (status !== 'loading') {
      if (!session?.user) {
        router.push('/auth/signin')
        return
      }
      
      if (!['ADMIN', 'HR'].includes(session.user.role)) {
        router.push('/dashboard')
        return
      }
      
      // Only fetch departments if user is authenticated and authorized
      fetchDepartments()
    }
  }, [session, status, router])

  useEffect(() => {
    const filtered = departments.filter(dept =>
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredDepartments(filtered)
  }, [departments, searchTerm])

  // Handle loading state
  if (status === 'loading') {
    return <div>Loading...</div>
  }

  // Handle unauthorized access
  if (!session?.user || !['ADMIN', 'HR'].includes(session.user.role)) {
    return <div>Redirecting...</div>
  }

  const fetchDepartments = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments || [])
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
      setError('Failed to fetch departments')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError(null)
      const url = editingDepartment 
        ? `/api/departments/${editingDepartment.id}`
        : '/api/departments'
      
      const response = await fetch(url, {
        method: editingDepartment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await fetchDepartments()
        setIsDialogOpen(false)
        setEditingDepartment(null)
        setFormData({ name: '', description: '' })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save department')
      }
    } catch (error) {
      setError('An error occurred while saving')
    }
  }

  const handleEdit = (department: Department) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
      description: department.description || ''
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return
    
    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchDepartments()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to delete department')
      }
    } catch (error) {
      setError('An error occurred while deleting')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', description: '' })
    setEditingDepartment(null)
    setError(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading departments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-gray-600">Manage organizational departments</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDepartment ? 'Edit Department' : 'Add New Department'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Department Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter department name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter department description"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  {editingDepartment ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDepartments.map((department) => (
          <Card key={department.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{department.name}</CardTitle>
                    {department.head && (
                      <p className="text-sm text-gray-600">
                        Head: {department.head.firstName} {department.head.lastName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(department)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(department.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {department.description && (
                <p className="text-gray-600 text-sm mb-3">{department.description}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {department._count?.employees || 0} employees
                  </span>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDepartments.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No departments found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'No departments match your search.' : 'Get started by creating your first department.'}
          </p>
          {!searchTerm && (
            <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
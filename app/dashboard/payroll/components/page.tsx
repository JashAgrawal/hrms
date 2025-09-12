'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, DollarSign, Search, Filter, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { DataTable } from '@/components/shared/data-table'

interface PayComponent {
  id: string
  name: string
  code: string
  type: 'EARNING' | 'DEDUCTION'
  category: 'BASIC' | 'ALLOWANCE' | 'BONUS' | 'OVERTIME' | 'STATUTORY_DEDUCTION' | 'OTHER_DEDUCTION' | 'REIMBURSEMENT'
  calculationType: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | 'ATTENDANCE_BASED'
  isStatutory: boolean
  isTaxable: boolean
  isActive: boolean
  description?: string
  formula?: string
  createdAt: string
  updatedAt: string
  _count: {
    structureComponents: number
  }
}

interface PayComponentFormData {
  name: string
  code: string
  type: 'EARNING' | 'DEDUCTION'
  category: 'BASIC' | 'ALLOWANCE' | 'BONUS' | 'OVERTIME' | 'STATUTORY_DEDUCTION' | 'OTHER_DEDUCTION' | 'REIMBURSEMENT'
  calculationType: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | 'ATTENDANCE_BASED'
  isStatutory: boolean
  isTaxable: boolean
  description: string
  formula: string
}

export default function PayComponentsPage() {
  const [components, setComponents] = useState<PayComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingComponent, setEditingComponent] = useState<PayComponent | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [formData, setFormData] = useState<PayComponentFormData>({
    name: '',
    code: '',
    type: 'EARNING',
    category: 'ALLOWANCE',
    calculationType: 'FIXED',
    isStatutory: false,
    isTaxable: true,
    description: '',
    formula: '',
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchComponents()
  }, [typeFilter, categoryFilter])

  const fetchComponents = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (typeFilter) params.append('type', typeFilter)
      if (categoryFilter) params.append('category', categoryFilter)

      const response = await fetch(`/api/payroll/pay-components?${params}`)
      if (response.ok) {
        const data = await response.json()
        setComponents(data)
      } else {
        throw new Error('Failed to fetch pay components')
      }
    } catch (error) {
      console.error('Error fetching components:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch pay components',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateComponent = async () => {
    try {
      const response = await fetch('/api/payroll/pay-components', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Pay component created successfully',
        })
        setShowCreateDialog(false)
        resetForm()
        fetchComponents()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create pay component')
      }
    } catch (error) {
      console.error('Error creating component:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create pay component',
        variant: 'destructive',
      })
    }
  }

  const handleEditComponent = (component: PayComponent) => {
    setEditingComponent(component)
    setFormData({
      name: component.name,
      code: component.code,
      type: component.type,
      category: component.category,
      calculationType: component.calculationType,
      isStatutory: component.isStatutory,
      isTaxable: component.isTaxable,
      description: component.description || '',
      formula: component.formula || '',
    })
    setShowCreateDialog(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'EARNING',
      category: 'ALLOWANCE',
      calculationType: 'FIXED',
      isStatutory: false,
      isTaxable: true,
      description: '',
      formula: '',
    })
    setEditingComponent(null)
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'EARNING':
        return 'bg-green-100 text-green-800'
      case 'DEDUCTION':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'BASIC':
        return 'bg-blue-100 text-blue-800'
      case 'ALLOWANCE':
        return 'bg-green-100 text-green-800'
      case 'STATUTORY_DEDUCTION':
        return 'bg-red-100 text-red-800'
      case 'BONUS':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Component',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-sm text-muted-foreground">{row.original.code}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: ({ row }: any) => (
        <Badge className={getTypeBadgeColor(row.original.type)}>
          {row.original.type}
        </Badge>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      cell: ({ row }: any) => (
        <Badge className={getCategoryBadgeColor(row.original.category)} variant="outline">
          {row.original.category.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'calculationType',
      header: 'Calculation',
      cell: ({ row }: any) => (
        <span className="text-sm">{row.original.calculationType}</span>
      ),
    },
    {
      key: 'properties',
      header: 'Properties',
      cell: ({ row }: any) => (
        <div className="flex flex-col gap-1">
          {row.original.isStatutory && (
            <Badge variant="secondary" className="text-xs w-fit">
              Statutory
            </Badge>
          )}
          {!row.original.isTaxable && (
            <Badge variant="secondary" className="text-xs w-fit">
              Non-Taxable
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      cell: ({ row }: any) => (
        <span className="text-sm">
          {row.original._count.structureComponents} structure(s)
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditComponent(row.original)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const filteredComponents = components.filter(component =>
    component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    component.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-blue-600" />
            Pay Components
          </h1>
          <p className="text-muted-foreground">
            Manage salary components for payroll calculations
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Component
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingComponent ? 'Edit Pay Component' : 'Create New Pay Component'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Component Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Basic Salary, HRA"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Component Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., BASIC, HRA"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EARNING">Earning</SelectItem>
                      <SelectItem value="DEDUCTION">Deduction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value: any) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BASIC">Basic</SelectItem>
                      <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                      <SelectItem value="BONUS">Bonus</SelectItem>
                      <SelectItem value="OVERTIME">Overtime</SelectItem>
                      <SelectItem value="STATUTORY_DEDUCTION">Statutory Deduction</SelectItem>
                      <SelectItem value="OTHER_DEDUCTION">Other Deduction</SelectItem>
                      <SelectItem value="REIMBURSEMENT">Reimbursement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="calculationType">Calculation Type</Label>
                <Select value={formData.calculationType} onValueChange={(value: any) => setFormData(prev => ({ ...prev, calculationType: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed Amount</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FORMULA">Formula Based</SelectItem>
                    <SelectItem value="ATTENDANCE_BASED">Attendance Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the component"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              {formData.calculationType === 'FORMULA' && (
                <div className="space-y-2">
                  <Label htmlFor="formula">Formula</Label>
                  <Input
                    id="formula"
                    placeholder="e.g., BASIC * 0.12"
                    value={formData.formula}
                    onChange={(e) => setFormData(prev => ({ ...prev, formula: e.target.value }))}
                  />
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="statutory"
                    checked={formData.isStatutory}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isStatutory: checked }))}
                  />
                  <Label htmlFor="statutory">Statutory Component</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="taxable"
                    checked={formData.isTaxable}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isTaxable: checked }))}
                  />
                  <Label htmlFor="taxable">Taxable</Label>
                </div>
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateComponent}
                  disabled={!formData.name || !formData.code}
                >
                  {editingComponent ? 'Update' : 'Create'} Component
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="EARNING">Earning</SelectItem>
                <SelectItem value="DEDUCTION">Deduction</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                <SelectItem value="BASIC">Basic</SelectItem>
                <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                <SelectItem value="STATUTORY_DEDUCTION">Statutory Deduction</SelectItem>
                <SelectItem value="BONUS">Bonus</SelectItem>
                <SelectItem value="OTHER_DEDUCTION">Other Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Components Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pay Components ({filteredComponents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredComponents}
            loading={loading}
            searchKey="name"
            searchPlaceholder="Search components..."
          />
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Plus, Search, Edit, Trash2, Calculator, TestTube } from 'lucide-react'
import { SalaryStructureTest } from '@/components/payroll/salary-structure-test'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SalaryComponent {
  id: string
  name: string
  code: string
  type: 'EARNING' | 'DEDUCTION'
  calculationType: 'FIXED' | 'PERCENTAGE' | 'FORMULA'
  category?: 'BASIC' | 'ALLOWANCE' | 'BONUS' | 'OVERTIME' | 'STATUTORY_DEDUCTION' | 'OTHER_DEDUCTION' | 'REIMBURSEMENT'
  value?: number
  formula?: string
  description?: string
  isStatutory: boolean
  isActive: boolean
  order: number
}

interface SalaryStructure {
  id: string
  name: string
  description?: string
  components: SalaryComponent[]
  isActive: boolean
  createdAt: string
}

export default function SalaryStructurePage() {
  const { data: session, status } = useSession()
  const [structures, setStructures] = useState<SalaryStructure[]>([])
  const [components, setComponents] = useState<SalaryComponent[]>([])
  const [filteredStructures, setFilteredStructures] = useState<SalaryStructure[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isStructureDialogOpen, setIsStructureDialogOpen] = useState(false)
  const [isComponentDialogOpen, setIsComponentDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null)
  const [editingComponent, setEditingComponent] = useState<SalaryComponent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'structures' | 'components' | 'test'>('structures')

  const [structureFormData, setStructureFormData] = useState({
    name: '',
    description: '',
    componentIds: [] as string[]
  })

  const [componentFormData, setComponentFormData] = useState({
    name: '',
    code: '',
    type: 'EARNING' as 'EARNING' | 'DEDUCTION',
    category: 'BASIC' as 'BASIC' | 'ALLOWANCE' | 'BONUS' | 'OVERTIME' | 'STATUTORY_DEDUCTION' | 'OTHER_DEDUCTION' | 'REIMBURSEMENT',
    calculationType: 'FIXED' as 'FIXED' | 'PERCENTAGE' | 'FORMULA',
    formula: '',
    description: '',
    isStatutory: false
  })

  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    structureId: '',
    ctc: '',
    effectiveFrom: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const filtered = structures.filter(structure =>
      structure.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      structure.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredStructures(filtered)
  }, [structures, searchTerm])

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [componentsRes, structuresRes] = await Promise.all([
        fetch('/api/payroll/pay-components'),
        fetch('/api/payroll/salary-structures')
      ])

      if (componentsRes.ok) {
        const comps = await componentsRes.json()
        setComponents(comps.map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          type: c.type,
          calculationType: c.calculationType,
          category: c.category,
          value: undefined,
          description: c.description,
          isStatutory: c.isStatutory,
          isActive: c.isActive,
          order: 0
        })))
      }

      if (structuresRes.ok) {
        const structs = await structuresRes.json()
        setStructures(structs.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          components: s.components.map((sc: any) => ({
            id: sc.component.id,
            name: sc.component.name,
            code: sc.component.code,
            type: sc.component.type,
            calculationType: sc.component.calculationType,
            category: sc.component.category,
            value: sc.value || sc.percentage || 0,
            description: sc.component.description,
            isStatutory: sc.component.isStatutory,
            isActive: true,
            order: sc.order
          })),
          isActive: s.isActive,
          createdAt: s.createdAt
        })))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to fetch salary structures')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStructureSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError(null)

      const method = editingStructure ? 'PUT' : 'POST'
      const url = editingStructure
        ? `/api/payroll/salary-structures/${editingStructure.id}`
        : '/api/payroll/salary-structures'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: structureFormData.name,
          code: structureFormData.name.toUpperCase().replace(/\s+/g, '_'),
          description: structureFormData.description || undefined,
          components: structureFormData.componentIds.map((componentId, index) => ({
            componentId,
            order: index,
            isVariable: false
          }))
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save salary structure')
      }

      await fetchData()
      setIsStructureDialogOpen(false)
      setEditingStructure(null)
      resetStructureForm()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save salary structure')
    }
  }

  const handleComponentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError(null)
      const res = await fetch('/api/payroll/pay-components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: componentFormData.name,
          code: componentFormData.code.toUpperCase(),
          type: componentFormData.type,
          category: componentFormData.category,
          calculationType: componentFormData.calculationType,
          isStatutory: componentFormData.isStatutory,
          isTaxable: true,
          description: componentFormData.description || undefined,
          formula: componentFormData.calculationType === 'FORMULA' ? (componentFormData.formula || '') : undefined,
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create component')
      }
      await fetchData()
      setIsComponentDialogOpen(false)
      setEditingComponent(null)
      resetComponentForm()
    } catch (error) {
      setError('Failed to save salary component')
    }
  }

  const resetStructureForm = () => {
    setStructureFormData({ name: '', description: '', componentIds: [] })
    setEditingStructure(null)
    setError(null)
  }

  const resetComponentForm = () => {
    setComponentFormData({
      name: '',
      code: '',
      type: 'EARNING',
      category: 'BASIC',
      calculationType: 'FIXED',
      formula: '',
      description: '',
      isStatutory: false
    })
    setEditingComponent(null)
    setError(null)
  }

  const handleEditStructure = (structure: SalaryStructure) => {
    setEditingStructure(structure)
    setStructureFormData({
      name: structure.name,
      description: structure.description || '',
      componentIds: structure.components.map(c => c.id)
    })
    setIsStructureDialogOpen(true)
  }

  const handleEditComponent = (component: SalaryComponent) => {
    setEditingComponent(component)
    setComponentFormData({
      name: component.name,
      code: component.code,
      type: component.type,
      category: component.category || 'BASIC',
      calculationType: component.calculationType,
      formula: component.formula || '',
      description: component.description || '',
      isStatutory: component.isStatutory
    })
    setIsComponentDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading salary structures...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Salary Structure</h1>
          <p className="text-gray-600">Manage salary components and structures</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'structures' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('structures')}
        >
          Salary Structures
        </Button>
        <Button
          variant={activeTab === 'components' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('components')}
        >
          Components
        </Button>
        <Button
          variant={activeTab === 'test' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('test')}
        >
          <TestTube className="h-4 w-4 mr-1" />
          Test
        </Button>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex space-x-2">
          {activeTab === 'structures' ? (
            <Dialog open={isStructureDialogOpen} onOpenChange={(open) => {
              setIsStructureDialogOpen(open)
              if (!open) resetStructureForm()
            }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Structure
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingStructure ? 'Edit Salary Structure' : 'Add New Salary Structure'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleStructureSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Structure Name</Label>
                      <Input
                        id="name"
                        value={structureFormData.name}
                        onChange={(e) => setStructureFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter structure name"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={structureFormData.description}
                      onChange={(e) => setStructureFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter structure description"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Salary Components</Label>
                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                      {components.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No components available. Create components first.</p>
                      ) : (
                        <div className="space-y-2">
                          {components.map((component) => (
                            <div key={component.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`component-${component.id}`}
                                checked={structureFormData.componentIds.includes(component.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setStructureFormData(prev => ({
                                      ...prev,
                                      componentIds: [...prev.componentIds, component.id]
                                    }))
                                  } else {
                                    setStructureFormData(prev => ({
                                      ...prev,
                                      componentIds: prev.componentIds.filter(id => id !== component.id)
                                    }))
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              <label htmlFor={`component-${component.id}`} className="flex-1 text-sm">
                                <div className="font-medium">{component.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {component.code} • {component.type} • {component.calculationType}
                                </div>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsStructureDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      {editingStructure ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={isComponentDialogOpen} onOpenChange={(open) => {
              setIsComponentDialogOpen(open)
              if (!open) resetComponentForm()
            }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Component
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingComponent ? 'Edit Salary Component' : 'Add New Salary Component'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleComponentSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="componentName">Component Name</Label>
                      <Input
                        id="componentName"
                        value={componentFormData.name}
                        onChange={(e) => setComponentFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter component name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code">Code</Label>
                      <Input
                        id="code"
                        value={componentFormData.code}
                        onChange={(e) => setComponentFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                        placeholder="Enter component code"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={componentFormData.type}
                        onValueChange={(value: 'EARNING' | 'DEDUCTION') => 
                          setComponentFormData(prev => ({ ...prev, type: value }))
                        }
                      >
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
                      <Select
                        value={componentFormData.category}
                        onValueChange={(value: any) => 
                          setComponentFormData(prev => ({ ...prev, category: value }))
                        }
                      >
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
                    <div className="space-y-2">
                      <Label htmlFor="calculationType">Calculation Type</Label>
                      <Select
                        value={componentFormData.calculationType}
                        onValueChange={(value: 'FIXED' | 'PERCENTAGE' | 'FORMULA') => 
                          setComponentFormData(prev => ({ ...prev, calculationType: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FIXED">Fixed Amount</SelectItem>
                          <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                          <SelectItem value="FORMULA">Formula</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Value will be configured when adding the component to a structure */}
                  {componentFormData.calculationType === 'FORMULA' && (
                    <div className="space-y-2">
                      <Label htmlFor="formula">Formula</Label>
                      <Input
                        id="formula"
                        value={componentFormData.formula}
                        onChange={(e) => setComponentFormData(prev => ({ ...prev, formula: e.target.value }))}
                        placeholder="e.g., BASIC * 0.4"
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="componentDescription">Description</Label>
                    <Textarea
                      id="componentDescription"
                      value={componentFormData.description}
                      onChange={(e) => setComponentFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter component description"
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isStatutory"
                      checked={componentFormData.isStatutory}
                      onChange={(e) => setComponentFormData(prev => ({ ...prev, isStatutory: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isStatutory">Statutory Component</Label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsComponentDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      {editingComponent ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'test' ? (
        <SalaryStructureTest />
      ) : activeTab === 'structures' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredStructures.map((structure) => (
            <Card key={structure.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{structure.name}</CardTitle>
                      {structure.description && (
                        <p className="text-sm text-gray-600">{structure.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditStructure(structure)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAssignForm(prev => ({ ...prev, structureId: structure.id }))
                        setIsAssignDialogOpen(true)
                      }}
                    >
                      Assign
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Components</span>
                    <Badge variant="secondary">{structure.components.length} items</Badge>
                  </div>
                  <div className="space-y-2">
                    {structure.components.slice(0, 3).map((component) => (
                      <div key={component.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <Badge variant={component.type === 'EARNING' ? 'default' : 'destructive'} className="text-xs">
                            {component.type}
                          </Badge>
                          <span className="text-sm">{component.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">{component.code}</span>
                      </div>
                    ))}
                    {structure.components.length > 3 && (
                      <p className="text-xs text-gray-500 text-center">
                        +{structure.components.length - 3} more components
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Badge variant={structure.isActive ? 'default' : 'secondary'}>
                      {structure.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button variant="outline" size="sm">
                      <Calculator className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {components.map((component) => (
            <Card key={component.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{component.name}</CardTitle>
                    <p className="text-sm text-gray-600">{component.code}</p>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditComponent(component)}
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
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={component.type === 'EARNING' ? 'default' : 'destructive'}>
                      {component.type}
                    </Badge>
                    <Badge variant="outline">{component.calculationType}</Badge>
                  </div>
                  {component.description && (
                    <p className="text-sm text-gray-600">{component.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {component.calculationType === 'PERCENTAGE' 
                        ? `${component.value}%` 
                        : component.calculationType === 'FIXED'
                        ? `₹${component.value?.toLocaleString()}`
                        : 'Formula based'}
                    </span>
                    {component.isStatutory && (
                      <Badge variant="secondary" className="text-xs">Statutory</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign Structure Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Salary Structure to Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            (async () => {
              try {
                setError(null)
                const res = await fetch('/api/payroll/employee-salary', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    employeeId: assignForm.employeeId,
                    structureId: assignForm.structureId,
                    ctc: parseFloat(assignForm.ctc),
                    effectiveFrom: new Date(assignForm.effectiveFrom).toISOString(),
                  })
                })
                if (!res.ok) {
                  const err = await res.json()
                  throw new Error(err.error || 'Failed to assign structure')
                }
                setIsAssignDialogOpen(false)
                setAssignForm({ employeeId: '', structureId: '', ctc: '', effectiveFrom: new Date().toISOString().split('T')[0] })
              } catch (e) {
                setError('Failed to assign salary structure')
              }
            })()
          }} className="space-y-3">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input id="employeeId" value={assignForm.employeeId} onChange={(e) => setAssignForm(prev => ({ ...prev, employeeId: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="structureId">Structure ID</Label>
              <Input id="structureId" value={assignForm.structureId} onChange={(e) => setAssignForm(prev => ({ ...prev, structureId: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctc">CTC (₹)</Label>
              <Input id="ctc" type="number" value={assignForm.ctc} onChange={(e) => setAssignForm(prev => ({ ...prev, ctc: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">Effective From</Label>
              <Input id="effectiveFrom" type="date" value={assignForm.effectiveFrom} onChange={(e) => setAssignForm(prev => ({ ...prev, effectiveFrom: e.target.value }))} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Assign</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {((activeTab === 'structures' && filteredStructures.length === 0) || 
        (activeTab === 'components' && components.length === 0)) && !isLoading && (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No {activeTab} found
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm 
              ? `No ${activeTab} match your search.` 
              : `Get started by creating your first ${activeTab.slice(0, -1)}.`}
          </p>
          {!searchTerm && (
            <Button 
              onClick={() => activeTab === 'structures' ? setIsStructureDialogOpen(true) : setIsComponentDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {activeTab === 'structures' ? 'Structure' : 'Component'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
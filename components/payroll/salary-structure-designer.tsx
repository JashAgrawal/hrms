'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Loader2, 
  Plus, 
  Trash2, 
  GripVertical,
  Calculator,
  Percent,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Info,
  Eye,
  Copy,
  Save,
  Layers
} from 'lucide-react'

// Enhanced schema for salary structure creation
const structureComponentSchema = z.object({
  componentId: z.string().min(1, 'Component is required'),
  value: z.number().optional(),
  percentage: z.number().optional(),
  baseComponent: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  isVariable: z.boolean(),
  order: z.number(),
  // Enhanced configuration
  configuration: z.object({
    isConditional: z.boolean(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(['equals', 'greater_than', 'less_than', 'between']),
      value: z.string(),
    })).optional(),
    effectiveDate: z.string().optional(),
    expiryDate: z.string().optional(),
  }).optional(),
})

const salaryStructureSchema = z.object({
  name: z.string().min(1, 'Structure name is required'),
  code: z.string().min(1, 'Structure code is required').regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores'),
  gradeId: z.string().optional(),
  description: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  components: z.array(structureComponentSchema).min(1, 'At least one component is required'),
  // Enhanced metadata
  metadata: z.object({
    category: z.enum(['STANDARD', 'EXECUTIVE', 'CONTRACTUAL', 'INTERN']).optional(),
    applicableRoles: z.array(z.string()).optional(),
    applicableDepartments: z.array(z.string()).optional(),
    isTemplate: z.boolean(),
    templateCategory: z.string().optional(),
    version: z.string().optional(),
    approvalRequired: z.boolean(),
  }).optional(),
})

type SalaryStructureFormData = z.infer<typeof salaryStructureSchema>

interface PayComponent {
  id: string
  name: string
  code: string
  type: 'EARNING' | 'DEDUCTION'
  category: string
  calculationType: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | 'ATTENDANCE_BASED'
  isStatutory: boolean
  isTaxable: boolean
  description?: string
  formula?: string
}

interface SalaryGrade {
  id: string
  name: string
  code: string
  minSalary: number
  maxSalary: number
}

interface SalaryStructureDesignerProps {
  initialData?: Partial<SalaryStructureFormData>
  payComponents: PayComponent[]
  salaryGrades: SalaryGrade[]
  existingStructures?: Array<{
    id: string
    name: string
    code: string
  }>
  onSubmit: (data: SalaryStructureFormData) => Promise<void>
  onCancel: () => void
  onPreview?: (data: SalaryStructureFormData, previewCTC: number) => void
  isLoading?: boolean
  mode?: 'create' | 'edit' | 'template'
}

const structureCategoryOptions = [
  { value: 'STANDARD', label: 'Standard', description: 'Regular full-time employees' },
  { value: 'EXECUTIVE', label: 'Executive', description: 'Senior management and executives' },
  { value: 'CONTRACTUAL', label: 'Contractual', description: 'Contract and temporary employees' },
  { value: 'INTERN', label: 'Intern', description: 'Interns and trainees' },
]

export function SalaryStructureDesigner({
  initialData,
  payComponents,
  salaryGrades,
  existingStructures = [],
  onSubmit,
  onCancel,
  onPreview,
  isLoading = false,
  mode = 'create'
}: SalaryStructureDesignerProps) {
  const [error, setError] = useState<string | null>(null)
  const [previewCTC, setPreviewCTC] = useState<number>(1200000) // Default 12 LPA
  const [showPreview, setShowPreview] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    control,
  } = useForm<SalaryStructureFormData>({
    resolver: zodResolver(salaryStructureSchema),
    defaultValues: {
      components: [],
      metadata: {
        category: 'STANDARD',
        applicableRoles: [],
        applicableDepartments: [],
        isTemplate: false,
        approvalRequired: true,
        version: '1.0',
      },
      ...initialData,
    },
  })

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'components',
  })

  const watchedComponents = watch('components')
  const watchedGradeId = watch('gradeId')
  const watchedName = watch('name')

  // Auto-generate code from name
  useEffect(() => {
    if (watchedName && mode === 'create') {
      const generatedCode = watchedName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      setValue('code', generatedCode)
    }
  }, [watchedName, mode, setValue])

  const selectedGrade = salaryGrades.find(g => g.id === watchedGradeId)

  const handleFormSubmit = async (data: SalaryStructureFormData) => {
    try {
      setError(null)
      
      // Validate component configurations
      const validationErrors = validateStructureComponents(data.components, payComponents)
      if (validationErrors.length > 0) {
        setError(`Validation errors: ${validationErrors.join(', ')}`)
        return
      }

      await onSubmit(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const validateStructureComponents = (components: any[], availableComponents: PayComponent[]): string[] => {
    const errors: string[] = []
    
    // Check for basic salary component
    const hasBasic = components.some(c => {
      const component = availableComponents.find(ac => ac.id === c.componentId)
      return component?.category === 'BASIC'
    })
    
    if (!hasBasic) {
      errors.push('Structure must include a basic salary component')
    }

    // Check for duplicate components
    const componentIds = components.map(c => c.componentId)
    const duplicates = componentIds.filter((id, index) => componentIds.indexOf(id) !== index)
    if (duplicates.length > 0) {
      errors.push('Duplicate components are not allowed')
    }

    // Validate component configurations
    components.forEach((comp, index) => {
      const component = availableComponents.find(ac => ac.id === comp.componentId)
      if (!component) {
        errors.push(`Component at position ${index + 1} not found`)
        return
      }

      if (component.calculationType === 'FIXED' && !comp.value) {
        errors.push(`Fixed component "${component.name}" must have a value`)
      }

      if (component.calculationType === 'PERCENTAGE' && !comp.percentage) {
        errors.push(`Percentage component "${component.name}" must have a percentage`)
      }

      if (comp.minValue && comp.maxValue && comp.minValue > comp.maxValue) {
        errors.push(`Component "${component.name}" minimum value cannot be greater than maximum value`)
      }
    })

    return errors
  }

  const addComponent = () => {
    append({
      componentId: '',
      value: undefined,
      percentage: undefined,
      baseComponent: undefined,
      minValue: undefined,
      maxValue: undefined,
      isVariable: false,
      order: fields.length,
      configuration: {
        isConditional: false,
        conditions: [],
      },
    })
  }

  const duplicateComponent = (index: number) => {
    const component = watchedComponents[index]
    append({
      ...component,
      order: fields.length,
    })
  }

  const getComponentById = (id: string): PayComponent | undefined => {
    return payComponents.find(c => c.id === id)
  }

  const calculatePreviewAmount = (componentIndex: number): number => {
    const component = watchedComponents[componentIndex]
    if (!component?.componentId) return 0

    const payComponent = getComponentById(component.componentId)
    if (!payComponent) return 0

    if (payComponent.calculationType === 'FIXED') {
      return component.value || 0
    }

    if (payComponent.calculationType === 'PERCENTAGE') {
      let baseAmount = previewCTC / 12 // Monthly amount
      
      if (component.baseComponent === 'BASIC') {
        // Find basic component value
        const basicComponent = watchedComponents.find(c => {
          const pc = getComponentById(c.componentId)
          return pc?.category === 'BASIC'
        })
        if (basicComponent) {
          const basicIndex = watchedComponents.indexOf(basicComponent)
          baseAmount = calculatePreviewAmount(basicIndex)
        }
      } else if (component.baseComponent === 'GROSS') {
        baseAmount = getTotalEarnings() / 12
      }
      
      const calculatedValue = (baseAmount * (component.percentage || 0)) / 100
      
      // Apply min/max constraints
      let finalValue = calculatedValue
      if (component.minValue && calculatedValue < component.minValue) {
        finalValue = component.minValue
      }
      if (component.maxValue && calculatedValue > component.maxValue) {
        finalValue = component.maxValue
      }
      
      return finalValue
    }

    return 0
  }

  const getTotalEarnings = (): number => {
    return watchedComponents.reduce((total, component, index) => {
      const payComponent = getComponentById(component.componentId)
      if (payComponent?.type === 'EARNING') {
        return total + calculatePreviewAmount(index)
      }
      return total
    }, 0)
  }

  const getTotalDeductions = (): number => {
    return watchedComponents.reduce((total, component, index) => {
      const payComponent = getComponentById(component.componentId)
      if (payComponent?.type === 'DEDUCTION') {
        return total + calculatePreviewAmount(index)
      }
      return total
    }, 0)
  }

  const getNetSalary = (): number => {
    return getTotalEarnings() - getTotalDeductions()
  }

  const handlePreview = () => {
    const formData = watch()
    setShowPreview(true)
    onPreview?.(formData, previewCTC)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      move(draggedIndex, dropIndex)
      // Update order values
      const newComponents = [...watchedComponents]
      newComponents.forEach((comp, index) => {
        setValue(`components.${index}.order`, index)
      })
    }
    setDraggedIndex(null)
  }

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Layers className="h-5 w-5" />
            <span>
              {mode === 'create' ? 'Create Salary Structure' : 
               mode === 'edit' ? 'Edit Salary Structure' : 
               'Create Structure Template'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Structure Name *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="e.g., Software Engineer L2"
                    disabled={isLoading || isSubmitting}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Structure Code *</Label>
                  <Input
                    id="code"
                    {...register('code')}
                    placeholder="e.g., SE_L2"
                    disabled={isLoading || isSubmitting}
                  />
                  {errors.code && (
                    <p className="text-sm text-red-600">{errors.code.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gradeId">Salary Grade</Label>
                  <Select
                    value={watchedGradeId}
                    onValueChange={(value) => setValue('gradeId', value)}
                    disabled={isLoading || isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select salary grade (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {salaryGrades.map((grade) => (
                        <SelectItem key={grade.id} value={grade.id}>
                          {grade.name} ({grade.code}) - ₹{grade.minSalary.toLocaleString()} to ₹{grade.maxSalary.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedGrade && (
                    <p className="text-xs text-gray-500">
                      Salary range: ₹{selectedGrade.minSalary.toLocaleString()} - ₹{selectedGrade.maxSalary.toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Structure Category</Label>
                  <Select
                    value={watch('metadata.category')}
                    onValueChange={(value) => setValue('metadata.category', value as any)}
                    disabled={isLoading || isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {structureCategoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className="text-xs text-gray-500">{option.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Brief description of this salary structure"
                  disabled={isLoading || isSubmitting}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="effectiveFrom">Effective From</Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    {...register('effectiveFrom')}
                    disabled={isLoading || isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="effectiveTo">Effective To</Label>
                  <Input
                    id="effectiveTo"
                    type="date"
                    {...register('effectiveTo')}
                    disabled={isLoading || isSubmitting}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Components Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Salary Components</h3>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreview}
                    disabled={isLoading || isSubmitting || fields.length === 0}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addComponent}
                    disabled={isLoading || isSubmitting}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Component
                  </Button>
                </div>
              </div>

              {fields.length === 0 && (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  <Layers className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">No components added yet</p>
                  <p className="text-sm mb-4">Start building your salary structure by adding components</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addComponent}
                    disabled={isLoading || isSubmitting}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Component
                  </Button>
                </div>
              )}

              {fields.map((field, index) => {
                const component = watchedComponents[index]
                const payComponent = component?.componentId ? getComponentById(component.componentId) : null
                const previewAmount = calculatePreviewAmount(index)

                return (
                  <Card 
                    key={field.id} 
                    className="p-4 transition-all duration-200 hover:shadow-md"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                          <span className="text-sm font-medium">Component {index + 1}</span>
                          {payComponent && (
                            <Badge variant={payComponent.type === 'EARNING' ? 'default' : 'destructive'}>
                              {payComponent.type}
                            </Badge>
                          )}
                          {payComponent?.isStatutory && (
                            <Badge variant="outline" className="text-xs">
                              Statutory
                            </Badge>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateComponent(index)}
                            disabled={isLoading || isSubmitting}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            disabled={isLoading || isSubmitting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Pay Component *</Label>
                          <Select
                            value={component?.componentId || ''}
                            onValueChange={(value) => {
                              setValue(`components.${index}.componentId`, value)
                              // Reset values when component changes
                              setValue(`components.${index}.value`, undefined)
                              setValue(`components.${index}.percentage`, undefined)
                            }}
                            disabled={isLoading || isSubmitting}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select component" />
                            </SelectTrigger>
                            <SelectContent>
                              {payComponents.map((pc) => (
                                <SelectItem key={pc.id} value={pc.id}>
                                  <div className="flex items-center space-x-2">
                                    <span>{pc.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {pc.calculationType}
                                    </Badge>
                                    {pc.isStatutory && (
                                      <Badge variant="secondary" className="text-xs">
                                        Statutory
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {payComponent?.calculationType === 'FIXED' && (
                          <div className="space-y-2">
                            <Label>Fixed Amount *</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="pl-10"
                                value={component?.value || ''}
                                onChange={(e) => setValue(`components.${index}.value`, parseFloat(e.target.value) || 0)}
                                disabled={isLoading || isSubmitting}
                              />
                            </div>
                          </div>
                        )}

                        {payComponent?.calculationType === 'PERCENTAGE' && (
                          <>
                            <div className="space-y-2">
                              <Label>Percentage *</Label>
                              <div className="relative">
                                <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  className="pl-10"
                                  value={component?.percentage || ''}
                                  onChange={(e) => setValue(`components.${index}.percentage`, parseFloat(e.target.value) || 0)}
                                  disabled={isLoading || isSubmitting}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {payComponent?.calculationType === 'PERCENTAGE' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Base Component</Label>
                            <Select
                              value={component?.baseComponent || 'CTC'}
                              onValueChange={(value) => setValue(`components.${index}.baseComponent`, value)}
                              disabled={isLoading || isSubmitting}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CTC">CTC</SelectItem>
                                <SelectItem value="BASIC">Basic Salary</SelectItem>
                                <SelectItem value="GROSS">Gross Salary</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Minimum Value</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Optional"
                              value={component?.minValue || ''}
                              onChange={(e) => setValue(`components.${index}.minValue`, parseFloat(e.target.value) || undefined)}
                              disabled={isLoading || isSubmitting}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Maximum Value</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Optional"
                              value={component?.maxValue || ''}
                              onChange={(e) => setValue(`components.${index}.maxValue`, parseFloat(e.target.value) || undefined)}
                              disabled={isLoading || isSubmitting}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={component?.isVariable || false}
                            onCheckedChange={(checked) => setValue(`components.${index}.isVariable`, !!checked)}
                            disabled={isLoading || isSubmitting}
                          />
                          <Label className="text-sm font-normal">
                            Variable component (can be adjusted per employee)
                          </Label>
                        </div>
                      </div>

                      {payComponent && (
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Preview Amount (Monthly):</span>
                            <span className="font-medium text-lg">₹{previewAmount.toLocaleString()}</span>
                          </div>
                          {payComponent.description && (
                            <p className="text-xs text-gray-500 mt-1">{payComponent.description}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}

              {errors.components && (
                <p className="text-sm text-red-600">{errors.components.message}</p>
              )}
            </div>

            <Separator />

            {/* Preview Section */}
            {fields.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Salary Preview</h3>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="previewCTC" className="text-sm">Preview CTC (Annual):</Label>
                    <Input
                      id="previewCTC"
                      type="number"
                      value={previewCTC}
                      onChange={(e) => setPreviewCTC(parseFloat(e.target.value) || 1200000)}
                      className="w-40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-600">Total Earnings</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">₹{getTotalEarnings().toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Monthly</p>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-600">Total Deductions</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">₹{getTotalDeductions().toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Monthly</p>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-600">Net Salary</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">₹{getNetSalary().toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Monthly</p>
                  </Card>
                </div>
              </div>
            )}

            <Separator />

            {/* Advanced Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Advanced Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    {...register('metadata.version')}
                    placeholder="e.g., 1.0, 2.1"
                    disabled={isLoading || isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="templateCategory">Template Category</Label>
                  <Input
                    id="templateCategory"
                    {...register('metadata.templateCategory')}
                    placeholder="e.g., Engineering, Sales"
                    disabled={isLoading || isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={watch('metadata.isTemplate')}
                    onCheckedChange={(checked) => setValue('metadata.isTemplate', !!checked)}
                    disabled={isLoading || isSubmitting}
                  />
                  <Label className="text-sm font-normal">
                    Save as template (can be reused for creating new structures)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={watch('metadata.approvalRequired')}
                    onCheckedChange={(checked) => setValue('metadata.approvalRequired', !!checked)}
                    disabled={isLoading || isSubmitting}
                  />
                  <Label className="text-sm font-normal">
                    Require approval before assignment to employees
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading || isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {mode === 'create' ? 'Create Structure' : 
                 mode === 'edit' ? 'Update Structure' : 
                 'Save Template'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
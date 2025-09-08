'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { 
  Loader2, 
  Plus, 
  Trash2, 
  GripVertical,
  Calculator,
  Percent,
  DollarSign
} from 'lucide-react'

const componentSchema = z.object({
  componentId: z.string().min(1, 'Component is required'),
  value: z.number().optional(),
  percentage: z.number().optional(),
  baseComponent: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  isVariable: z.boolean().default(false),
  order: z.number().default(0),
})

const salaryStructureSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  gradeId: z.string().optional(),
  description: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  components: z.array(componentSchema).min(1, 'At least one component is required'),
})

type SalaryStructureFormData = z.infer<typeof salaryStructureSchema>

interface PayComponent {
  id: string
  name: string
  code: string
  type: string
  category: string
  calculationType: string
  isStatutory: boolean
  isTaxable: boolean
}

interface SalaryGrade {
  id: string
  name: string
  code: string
  minSalary: number
  maxSalary: number
}

interface SalaryStructureBuilderProps {
  initialData?: Partial<SalaryStructureFormData>
  payComponents: PayComponent[]
  salaryGrades: SalaryGrade[]
  onSubmit: (data: SalaryStructureFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function SalaryStructureBuilder({
  initialData,
  payComponents,
  salaryGrades,
  onSubmit,
  onCancel,
  isLoading = false,
}: SalaryStructureBuilderProps) {
  const [error, setError] = useState<string | null>(null)
  const [previewCTC, setPreviewCTC] = useState<number>(100000)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    control,
  } = useForm({
    resolver: zodResolver(salaryStructureSchema),
    defaultValues: {
      components: [],
      ...initialData,
    },
  }) as any

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'components',
  })

  const watchedComponents = watch('components')
  const watchedGradeId = watch('gradeId')

  const selectedGrade: SalaryGrade | undefined = salaryGrades.find((g: SalaryGrade) => g.id === watchedGradeId)

  const handleFormSubmit = async (data: SalaryStructureFormData) => {
    try {
      setError(null)
      await onSubmit(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
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
    })
  }

  const getComponentById = (id: string): PayComponent | undefined => {
    return payComponents.find((c: PayComponent) => c.id === id)
  }

  const calculatePreviewAmount = (componentIndex: number): number => {
    const component = watchedComponents[componentIndex]
    if (!component?.componentId) return 0

    const payComponent: PayComponent | undefined = getComponentById(component.componentId)
    if (!payComponent) return 0

    if (payComponent.calculationType === 'FIXED') {
      return component.value || 0
    }

    if (payComponent.calculationType === 'PERCENTAGE') {
      let baseAmount: number = previewCTC
      
      if (component.baseComponent === 'BASIC') {
        // Find basic component value
        const basicComponent = watchedComponents.find((c: any) => {
          const pc: PayComponent | undefined = getComponentById(c.componentId)
          return pc?.category === 'BASIC'
        })
        if (basicComponent) {
          baseAmount = calculatePreviewAmount(watchedComponents.indexOf(basicComponent))
        }
      }
      
      const calculatedValue: number = (baseAmount * (component.percentage || 0)) / 100
      
      // Apply min/max constraints
      let finalValue: number = calculatedValue
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
    return watchedComponents.reduce((total: number, component: any, index: number) => {
      const payComponent = getComponentById(component.componentId)
      if (payComponent?.type === 'EARNING') {
        return total + calculatePreviewAmount(index)
      }
      return total
    }, 0)
  }

  const getTotalDeductions = (): number => {
    return watchedComponents.reduce((total: number, component: any, index: number) => {
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

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            {initialData ? 'Edit Salary Structure' : 'Create Salary Structure'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Basic Information */}
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Optional description for this salary structure"
                disabled={isLoading || isSubmitting}
                rows={3}
              />
            </div>

            <Separator />

            {/* Components Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Pay Components</h3>
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

              {fields.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No components added yet. Click "Add Component" to get started.
                </div>
              )}

              {fields.map((field, index) => {
                const component = watchedComponents[index]
                const payComponent = component?.componentId ? getComponentById(component.componentId) : null
                const previewAmount = calculatePreviewAmount(index)

                return (
                  <Card key={field.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <GripVertical className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Component {index + 1}</span>
                          {payComponent && (
                            <Badge variant={payComponent.type === 'EARNING' ? 'default' : 'destructive'}>
                              {payComponent.type}
                            </Badge>
                          )}
                        </div>
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Pay Component *</Label>
                          <Select
                            value={component?.componentId || ''}
                            onValueChange={(value) => setValue(`components.${index}.componentId`, value)}
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
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>

                      {payComponent?.calculationType === 'PERCENTAGE' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                      {payComponent && (
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Preview Amount:</span>
                            <span className="font-medium">₹{previewAmount.toLocaleString()}</span>
                          </div>
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
                    <Label htmlFor="previewCTC" className="text-sm">Preview CTC:</Label>
                    <Input
                      id="previewCTC"
                      type="number"
                      value={previewCTC}
                      onChange={(e) => setPreviewCTC(parseFloat(e.target.value) || 100000)}
                      className="w-32"
                    />
                  </div>
                </div>

                <Card className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-green-600">Total Earnings:</span>
                      <span className="font-medium text-green-600">₹{getTotalEarnings().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-red-600">Total Deductions:</span>
                      <span className="font-medium text-red-600">₹{getTotalDeductions().toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Net Salary:</span>
                      <span className="font-bold">₹{getNetSalary().toLocaleString()}</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

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
                {initialData ? 'Update Structure' : 'Create Structure'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Calculator,
  Percent,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react'

// Enhanced schema for salary component creation
const salaryComponentSchema = z.object({
  name: z.string().min(1, 'Component name is required'),
  code: z.string().min(1, 'Component code is required').regex(/^[A-Z_]+$/, 'Code must contain only uppercase letters and underscores'),
  type: z.enum(['EARNING', 'DEDUCTION']),
  category: z.enum([
    'BASIC',
    'ALLOWANCE', 
    'BONUS',
    'OVERTIME',
    'STATUTORY_DEDUCTION',
    'OTHER_DEDUCTION',
    'REIMBURSEMENT'
  ]),
  calculationType: z.enum(['FIXED', 'PERCENTAGE', 'FORMULA', 'ATTENDANCE_BASED']),
  isStatutory: z.boolean(),
  isTaxable: z.boolean(),
  description: z.string().optional(),
  formula: z.string().optional(),
  // Enhanced validation rules
  validationRules: z.object({
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    dependsOn: z.array(z.string()).optional(), // Component codes this depends on
    applicableRoles: z.array(z.string()).optional(), // Roles this component applies to
    effectiveDate: z.string().optional(),
    expiryDate: z.string().optional(),
  }).optional(),
  // Calculation parameters
  calculationParams: z.object({
    baseComponent: z.string().optional(), // For percentage calculations
    multiplier: z.number().optional(), // For formula calculations
    roundingRule: z.enum(['ROUND_UP', 'ROUND_DOWN', 'ROUND_NEAREST']).optional(),
    prorationRule: z.enum(['DAILY', 'MONTHLY', 'NONE']).optional(),
  }).optional(),
})

type SalaryComponentFormData = z.infer<typeof salaryComponentSchema>

interface SalaryComponentBuilderProps {
  initialData?: Partial<SalaryComponentFormData>
  existingComponents?: Array<{
    id: string
    name: string
    code: string
    type: string
    category: string
  }>
  onSubmit: (data: SalaryComponentFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  mode?: 'create' | 'edit'
}

const componentTypeOptions = [
  { value: 'EARNING', label: 'Earning', description: 'Components that add to employee salary' },
  { value: 'DEDUCTION', label: 'Deduction', description: 'Components that reduce employee salary' },
]

const componentCategoryOptions = [
  { value: 'BASIC', label: 'Basic Salary', description: 'Base salary component' },
  { value: 'ALLOWANCE', label: 'Allowance', description: 'Additional allowances (HRA, Transport, etc.)' },
  { value: 'BONUS', label: 'Bonus', description: 'Performance or festival bonuses' },
  { value: 'OVERTIME', label: 'Overtime', description: 'Overtime compensation' },
  { value: 'STATUTORY_DEDUCTION', label: 'Statutory Deduction', description: 'PF, ESI, TDS, PT' },
  { value: 'OTHER_DEDUCTION', label: 'Other Deduction', description: 'Loan, advance, etc.' },
  { value: 'REIMBURSEMENT', label: 'Reimbursement', description: 'Expense reimbursements' },
]

const calculationTypeOptions = [
  { value: 'FIXED', label: 'Fixed Amount', description: 'Fixed monetary value' },
  { value: 'PERCENTAGE', label: 'Percentage', description: 'Percentage of base component' },
  { value: 'FORMULA', label: 'Formula', description: 'Custom calculation formula' },
  { value: 'ATTENDANCE_BASED', label: 'Attendance Based', description: 'Based on attendance data' },
]

const roundingRuleOptions = [
  { value: 'ROUND_UP', label: 'Round Up' },
  { value: 'ROUND_DOWN', label: 'Round Down' },
  { value: 'ROUND_NEAREST', label: 'Round to Nearest' },
]

const prorationRuleOptions = [
  { value: 'DAILY', label: 'Daily Proration' },
  { value: 'MONTHLY', label: 'Monthly Proration' },
  { value: 'NONE', label: 'No Proration' },
]

export function SalaryComponentBuilder({
  initialData,
  existingComponents = [],
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create'
}: SalaryComponentBuilderProps) {
  const [error, setError] = useState<string | null>(null)
  const [previewCalculation, setPreviewCalculation] = useState<any>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    control,
  } = useForm<SalaryComponentFormData>({
    resolver: zodResolver(salaryComponentSchema),
    defaultValues: {
      isStatutory: false,
      isTaxable: true,
      validationRules: {
        dependsOn: [],
        applicableRoles: [],
      },
      calculationParams: {
        roundingRule: 'ROUND_NEAREST',
        prorationRule: 'DAILY',
      },
      ...initialData,
    },
  })

  const watchedType = watch('type')
  const watchedCategory = watch('category')
  const watchedCalculationType = watch('calculationType')
  const watchedCode = watch('code')

  // Auto-generate code from name
  useEffect(() => {
    const name = watch('name')
    if (name && !watchedCode && mode === 'create') {
      const generatedCode = name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      setValue('code', generatedCode)
    }
  }, [watch('name'), watchedCode, mode, setValue])

  // Filter categories based on type
  const availableCategories = componentCategoryOptions.filter(option => {
    if (watchedType === 'EARNING') {
      return !['STATUTORY_DEDUCTION', 'OTHER_DEDUCTION'].includes(option.value)
    } else if (watchedType === 'DEDUCTION') {
      return ['STATUTORY_DEDUCTION', 'OTHER_DEDUCTION'].includes(option.value)
    }
    return true
  })

  // Get base components for percentage calculations
  const baseComponents = existingComponents.filter(comp => 
    comp.type === 'EARNING' && ['BASIC', 'ALLOWANCE'].includes(comp.category)
  )

  const handleFormSubmit = async (data: SalaryComponentFormData) => {
    try {
      setError(null)
      
      // Validate formula if calculation type is FORMULA
      if (data.calculationType === 'FORMULA' && data.formula) {
        const isValidFormula = validateFormula(data.formula, existingComponents)
        if (!isValidFormula) {
          setError('Invalid formula. Please check component codes and syntax.')
          return
        }
      }

      await onSubmit(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const validateFormula = (formula: string, components: any[]): boolean => {
    try {
      // Basic validation - check if referenced components exist
      const componentCodes = components.map(c => c.code)
      const referencedCodes = formula.match(/[A-Z_]+/g) || []
      
      for (const code of referencedCodes) {
        if (!componentCodes.includes(code) && !['BASIC', 'GROSS', 'CTC'].includes(code)) {
          return false
        }
      }
      
      // Check for basic mathematical operators
      const validPattern = /^[A-Z_\s\+\-\*\/\(\)\.\d]+$/
      return validPattern.test(formula)
    } catch {
      return false
    }
  }

  const calculatePreview = () => {
    const formData = watch()
    if (formData.calculationType === 'FIXED') {
      return { type: 'fixed', amount: 0 }
    } else if (formData.calculationType === 'PERCENTAGE') {
      return { type: 'percentage', rate: 0, baseComponent: formData.calculationParams?.baseComponent }
    } else if (formData.calculationType === 'FORMULA') {
      return { type: 'formula', formula: formData.formula }
    }
    return null
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calculator className="h-5 w-5" />
          <span>{mode === 'create' ? 'Create Salary Component' : 'Edit Salary Component'}</span>
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
                <Label htmlFor="name">Component Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="e.g., House Rent Allowance"
                  disabled={isLoading || isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Component Code *</Label>
                <Input
                  id="code"
                  {...register('code')}
                  placeholder="e.g., HRA"
                  disabled={isLoading || isSubmitting}
                />
                {errors.code && (
                  <p className="text-sm text-red-600">{errors.code.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Component Type *</Label>
                <Select
                  value={watch('type')}
                  onValueChange={(value) => setValue('type', value as 'EARNING' | 'DEDUCTION')}
                  disabled={isLoading || isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {componentTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-gray-500">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-red-600">{errors.type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={watch('category')}
                  onValueChange={(value) => setValue('category', value as any)}
                  disabled={isLoading || isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-gray-500">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-red-600">{errors.category.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Brief description of this component"
                disabled={isLoading || isSubmitting}
                rows={3}
              />
            </div>
          </div>

          <Separator />

          {/* Calculation Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Calculation Configuration</h3>
            
            <div className="space-y-2">
              <Label htmlFor="calculationType">Calculation Type *</Label>
              <Select
                value={watch('calculationType')}
                onValueChange={(value) => setValue('calculationType', value as any)}
                disabled={isLoading || isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select calculation type" />
                </SelectTrigger>
                <SelectContent>
                  {calculationTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-gray-500">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.calculationType && (
                <p className="text-sm text-red-600">{errors.calculationType.message}</p>
              )}
            </div>

            {/* Calculation Parameters */}
            {watchedCalculationType === 'PERCENTAGE' && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium">Percentage Calculation Settings</h4>
                <div className="space-y-2">
                  <Label htmlFor="baseComponent">Base Component</Label>
                  <Select
                    value={watch('calculationParams.baseComponent')}
                    onValueChange={(value) => setValue('calculationParams.baseComponent', value)}
                    disabled={isLoading || isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select base component" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CTC">CTC (Cost to Company)</SelectItem>
                      <SelectItem value="BASIC">Basic Salary</SelectItem>
                      <SelectItem value="GROSS">Gross Salary</SelectItem>
                      {baseComponents.map((comp) => (
                        <SelectItem key={comp.id} value={comp.code}>
                          {comp.name} ({comp.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {watchedCalculationType === 'FORMULA' && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium">Formula Configuration</h4>
                <div className="space-y-2">
                  <Label htmlFor="formula">Formula *</Label>
                  <Textarea
                    id="formula"
                    {...register('formula')}
                    placeholder="e.g., BASIC * 0.4 + TRANSPORT"
                    disabled={isLoading || isSubmitting}
                    rows={2}
                  />
                  <div className="text-xs text-gray-500">
                    <p>Available variables: BASIC, GROSS, CTC, {existingComponents.map(c => c.code).join(', ')}</p>
                    <p>Operators: +, -, *, /, (, )</p>
                  </div>
                  {errors.formula && (
                    <p className="text-sm text-red-600">{errors.formula.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Advanced Calculation Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roundingRule">Rounding Rule</Label>
                <Select
                  value={watch('calculationParams.roundingRule')}
                  onValueChange={(value) => setValue('calculationParams.roundingRule', value as any)}
                  disabled={isLoading || isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roundingRuleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prorationRule">Proration Rule</Label>
                <Select
                  value={watch('calculationParams.prorationRule')}
                  onValueChange={(value) => setValue('calculationParams.prorationRule', value as any)}
                  disabled={isLoading || isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {prorationRuleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Validation Rules */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Validation Rules</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minValue">Minimum Value</Label>
                <Input
                  id="minValue"
                  type="number"
                  step="0.01"
                  {...register('validationRules.minValue', { valueAsNumber: true })}
                  placeholder="0.00"
                  disabled={isLoading || isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxValue">Maximum Value</Label>
                <Input
                  id="maxValue"
                  type="number"
                  step="0.01"
                  {...register('validationRules.maxValue', { valueAsNumber: true })}
                  placeholder="0.00"
                  disabled={isLoading || isSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective Date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  {...register('validationRules.effectiveDate')}
                  disabled={isLoading || isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  {...register('validationRules.expiryDate')}
                  disabled={isLoading || isSubmitting}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Component Properties */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Component Properties</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isStatutory"
                  checked={watch('isStatutory')}
                  onCheckedChange={(checked) => setValue('isStatutory', !!checked)}
                  disabled={isLoading || isSubmitting}
                />
                <Label htmlFor="isStatutory" className="text-sm font-normal">
                  Statutory component (PF, ESI, TDS, PT, etc.)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isTaxable"
                  checked={watch('isTaxable')}
                  onCheckedChange={(checked) => setValue('isTaxable', !!checked)}
                  disabled={isLoading || isSubmitting}
                />
                <Label htmlFor="isTaxable" className="text-sm font-normal">
                  Taxable component (subject to income tax)
                </Label>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          {watchedCalculationType && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Component Preview</span>
              </div>
              <div className="text-sm text-blue-800">
                <p><strong>Type:</strong> {watchedType} - {watchedCategory}</p>
                <p><strong>Calculation:</strong> {watchedCalculationType}</p>
                {watchedCalculationType === 'PERCENTAGE' && (
                  <p><strong>Base:</strong> {watch('calculationParams.baseComponent') || 'Not selected'}</p>
                )}
                {watchedCalculationType === 'FORMULA' && watch('formula') && (
                  <p><strong>Formula:</strong> {watch('formula')}</p>
                )}
              </div>
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
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mode === 'create' ? 'Create Component' : 'Update Component'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
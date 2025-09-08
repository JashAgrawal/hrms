'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

const salaryGradeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  minSalary: z.number().positive('Minimum salary must be positive'),
  maxSalary: z.number().positive('Maximum salary must be positive'),
  currency: z.string().default('INR'),
}).refine(data => data.maxSalary > data.minSalary, {
  message: 'Maximum salary must be greater than minimum salary',
  path: ['maxSalary'],
})

type SalaryGradeFormData = z.infer<typeof salaryGradeSchema>

interface SalaryGradeFormProps {
  initialData?: Partial<SalaryGradeFormData>
  onSubmit: (data: SalaryGradeFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function SalaryGradeForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: SalaryGradeFormProps) {
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm({
    resolver: zodResolver(salaryGradeSchema),
    defaultValues: {
      currency: 'INR',
      ...initialData,
    },
  }) as any

  const handleFormSubmit = async (data: SalaryGradeFormData) => {
    try {
      setError(null)
      await onSubmit(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const minSalary = watch('minSalary')

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {initialData ? 'Edit Salary Grade' : 'Create Salary Grade'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Grade Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="e.g., Senior Manager"
                disabled={isLoading || isSubmitting}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Grade Code *</Label>
              <Input
                id="code"
                {...register('code')}
                placeholder="e.g., SMGR"
                disabled={isLoading || isSubmitting}
              />
              {errors.code && (
                <p className="text-sm text-red-600">{errors.code.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Optional description for this salary grade"
              disabled={isLoading || isSubmitting}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minSalary">Minimum Salary *</Label>
              <Input
                id="minSalary"
                type="number"
                step="0.01"
                {...register('minSalary', { valueAsNumber: true })}
                placeholder="50000"
                disabled={isLoading || isSubmitting}
              />
              {errors.minSalary && (
                <p className="text-sm text-red-600">{errors.minSalary.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxSalary">Maximum Salary *</Label>
              <Input
                id="maxSalary"
                type="number"
                step="0.01"
                {...register('maxSalary', { valueAsNumber: true })}
                placeholder="100000"
                disabled={isLoading || isSubmitting}
                min={minSalary || 0}
              />
              {errors.maxSalary && (
                <p className="text-sm text-red-600">{errors.maxSalary.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                {...register('currency')}
                placeholder="INR"
                disabled={isLoading || isSubmitting}
              />
              {errors.currency && (
                <p className="text-sm text-red-600">{errors.currency.message}</p>
              )}
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
              {initialData ? 'Update Grade' : 'Create Grade'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
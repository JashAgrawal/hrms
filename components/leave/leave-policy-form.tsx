'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'

const leavePolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  code: z.string().min(1, 'Policy code is required').max(10, 'Code must be 10 characters or less'),
  type: z.enum(['ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'EMERGENCY', 'COMPENSATORY']),
  description: z.string().optional(),
  daysPerYear: z.number().min(0, 'Days per year must be non-negative'),
  carryForward: z.boolean().default(false),
  maxCarryForward: z.number().optional(),
  maxConsecutiveDays: z.number().optional(),
  minAdvanceNotice: z.number().min(0).optional(),
  requiresApproval: z.boolean().default(true),
  approvalLevels: z.number().min(1).max(5).default(1),
  accrualType: z.enum(['ANNUAL', 'MONTHLY', 'QUARTERLY', 'ON_JOINING']).default('ANNUAL'),
  accrualRate: z.number().optional(),
  probationPeriodDays: z.number().min(0).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  isEncashable: z.boolean().default(false),
  encashmentRate: z.number().min(0).max(200).optional(),
  isActive: z.boolean().default(true),
})

type LeavePolicyFormData = z.infer<typeof leavePolicySchema>

interface LeavePolicyFormProps {
  policy?: any
  onSuccess: () => void
  onCancel: () => void
}

export function LeavePolicyForm({ policy, onSuccess, onCancel }: LeavePolicyFormProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const form = useForm({
    resolver: zodResolver(leavePolicySchema),
    defaultValues: {
      name: policy?.name || '',
      code: policy?.code || '',
      type: policy?.type || 'ANNUAL',
      description: policy?.description || '',
      daysPerYear: policy?.daysPerYear || 0,
      carryForward: policy?.carryForward || false,
      maxCarryForward: policy?.maxCarryForward || undefined,
      maxConsecutiveDays: policy?.maxConsecutiveDays || undefined,
      minAdvanceNotice: policy?.minAdvanceNotice || undefined,
      requiresApproval: policy?.requiresApproval ?? true,
      approvalLevels: policy?.approvalLevels || 1,
      accrualType: policy?.accrualType || 'ANNUAL',
      accrualRate: policy?.accrualRate || undefined,
      probationPeriodDays: policy?.probationPeriodDays || undefined,
      gender: policy?.gender || undefined,
      isEncashable: policy?.isEncashable || false,
      encashmentRate: policy?.encashmentRate || undefined,
      isActive: policy?.isActive ?? true,
    },
  })

  const watchCarryForward = form.watch('carryForward')
  const watchRequiresApproval = form.watch('requiresApproval')
  const watchAccrualType = form.watch('accrualType')
  const watchIsEncashable = form.watch('isEncashable')

  const onSubmit = async (data: LeavePolicyFormData) => {
    try {
      setLoading(true)
      
      const url = policy ? `/api/leave/policies/${policy.id}` : '/api/leave/policies'
      const method = policy ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save policy')
      }
    } catch (error) {
      console.error('Error saving policy:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save policy',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const leaveTypes = [
    { value: 'ANNUAL', label: 'Annual Leave' },
    { value: 'SICK', label: 'Sick Leave' },
    { value: 'CASUAL', label: 'Casual Leave' },
    { value: 'MATERNITY', label: 'Maternity Leave' },
    { value: 'PATERNITY', label: 'Paternity Leave' },
    { value: 'EMERGENCY', label: 'Emergency Leave' },
    { value: 'COMPENSATORY', label: 'Compensatory Leave' },
  ]

  const accrualTypes = [
    { value: 'ANNUAL', label: 'Annual (All at once)' },
    { value: 'MONTHLY', label: 'Monthly Accrual' },
    { value: 'QUARTERLY', label: 'Quarterly Accrual' },
    { value: 'ON_JOINING', label: 'Pro-rated from Joining' },
  ]

  const genderOptions = [
    { value: 'MALE', label: 'Male Only' },
    { value: 'FEMALE', label: 'Female Only' },
    { value: 'OTHER', label: 'Other' },
  ]

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Configure the basic details of the leave policy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Annual Leave" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., AL" {...field} />
                    </FormControl>
                    <FormDescription>
                      Short code for the policy (max 10 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leave Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leaveTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the policy"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender Restriction</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All genders" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">All Genders</SelectItem>
                        {genderOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Leave this empty if the policy applies to all genders
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active Policy</FormLabel>
                      <FormDescription>
                        Whether this policy is currently active
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Leave Allocation */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Allocation</CardTitle>
              <CardDescription>
                Configure how leave days are allocated and accrued
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="daysPerYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Days Per Year</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Total number of leave days allocated per year
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accrualType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accrual Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select accrual type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accrualTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How leave days are allocated throughout the year
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchAccrualType === 'MONTHLY' && (
                <FormField
                  control={form.control}
                  name="accrualRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Accrual Rate</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="e.g., 1.75"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of days accrued per month
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="probationPeriodDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Probation Period (Days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g., 90"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value) || undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Days after joining when leave becomes available (0 for immediate)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="carryForward"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Allow Carry Forward</FormLabel>
                      <FormDescription>
                        Allow unused leave to carry forward to next year
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {watchCarryForward && (
                <FormField
                  control={form.control}
                  name="maxCarryForward"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Carry Forward Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Leave empty for unlimited"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum days that can be carried forward
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Leave Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Rules</CardTitle>
              <CardDescription>
                Configure rules and restrictions for leave requests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="maxConsecutiveDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Consecutive Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Leave empty for no limit"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value) || undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum consecutive days that can be taken at once
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minAdvanceNotice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Advance Notice (Days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g., 7"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value) || undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum days of advance notice required
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requiresApproval"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Requires Approval</FormLabel>
                      <FormDescription>
                        Whether leave requests need approval
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {watchRequiresApproval && (
                <FormField
                  control={form.control}
                  name="approvalLevels"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Approval Levels</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of approval levels required (1-5)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Encashment */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Encashment</CardTitle>
              <CardDescription>
                Configure leave encashment options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="isEncashable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Allow Encashment</FormLabel>
                      <FormDescription>
                        Allow unused leave to be encashed
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {watchIsEncashable && (
                <FormField
                  control={form.control}
                  name="encashmentRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Encashment Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="200"
                          step="0.01"
                          placeholder="e.g., 100"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Percentage of daily salary for encashment (100% = full day salary)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : policy ? 'Update Policy' : 'Create Policy'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
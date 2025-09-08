'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, addDays, differenceInBusinessDays } from 'date-fns'
import { Calendar as CalendarIcon, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const leaveRequestSchema = z.object({
  policyId: z.string().min(1, 'Leave policy is required'),
  startDate: z.date({ required_error: 'Start date is required' }),
  endDate: z.date({ required_error: 'End date is required' }),
  reason: z.string().min(1, 'Reason is required'),
  emergencyContact: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    relationship: z.string().optional(),
  }).optional(),
  handoverNotes: z.string().optional(),
  isHalfDay: z.boolean(),
  halfDayType: z.enum(['FIRST_HALF', 'SECOND_HALF']).optional(),
}).refine((data) => {
  if (data.isHalfDay) {
    return data.startDate.getTime() === data.endDate.getTime()
  }
  return data.startDate <= data.endDate
}, {
  message: 'For half-day leave, start and end date must be the same',
  path: ['endDate']
})

type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>

interface LeavePolicy {
  id: string
  name: string
  code: string
  type: string
  daysPerYear: number
  maxConsecutiveDays?: number
  minAdvanceNotice?: number
  requiresApproval: boolean
  approvalLevels: number
}

interface LeaveBalance {
  id: string
  available: number
  policy: LeavePolicy
}

interface LeaveRequestFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function LeaveRequestForm({ onSuccess, onCancel }: LeaveRequestFormProps) {
  const [loading, setLoading] = useState(false)
  const [policies, setPolicies] = useState<LeavePolicy[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [selectedPolicy, setSelectedPolicy] = useState<LeavePolicy | null>(null)
  const [selectedBalance, setSelectedBalance] = useState<LeaveBalance | null>(null)
  const [calculatedDays, setCalculatedDays] = useState(0)
  const { toast } = useToast()

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      isHalfDay: false,
      emergencyContact: {},
    },
  })

  const watchPolicyId = form.watch('policyId')
  const watchStartDate = form.watch('startDate')
  const watchEndDate = form.watch('endDate')
  const watchIsHalfDay = form.watch('isHalfDay')

  // Fetch leave policies and balances
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [policiesRes, balancesRes] = await Promise.all([
          fetch('/api/leave/policies'),
          fetch('/api/leave/balances')
        ])

        if (policiesRes.ok) {
          const policiesData = await policiesRes.json()
          setPolicies(policiesData)
        }

        if (balancesRes.ok) {
          const balancesData = await balancesRes.json()
          setBalances(balancesData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast({
          title: 'Error',
          description: 'Failed to load leave policies and balances',
          variant: 'destructive',
        })
      }
    }

    fetchData()
  }, [toast])

  // Update selected policy and balance when policy changes
  useEffect(() => {
    if (watchPolicyId) {
      const policy = policies.find(p => p.id === watchPolicyId)
      const balance = balances.find(b => b.policy.id === watchPolicyId)
      setSelectedPolicy(policy || null)
      setSelectedBalance(balance || null)
    } else {
      setSelectedPolicy(null)
      setSelectedBalance(null)
    }
  }, [watchPolicyId, policies, balances])

  // Calculate leave days when dates change
  useEffect(() => {
    if (watchStartDate && watchEndDate) {
      if (watchIsHalfDay) {
        setCalculatedDays(0.5)
      } else {
        const days = differenceInBusinessDays(watchEndDate, watchStartDate) + 1
        setCalculatedDays(Math.max(0, days))
      }
    } else {
      setCalculatedDays(0)
    }
  }, [watchStartDate, watchEndDate, watchIsHalfDay])

  // Update end date when half-day is toggled
  useEffect(() => {
    if (watchIsHalfDay && watchStartDate) {
      form.setValue('endDate', watchStartDate)
    }
  }, [watchIsHalfDay, watchStartDate, form])

  const onSubmit = async (data: LeaveRequestFormData) => {
    try {
      setLoading(true)

      const response = await fetch('/api/leave/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
        }),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Leave request submitted successfully',
        })
        onSuccess()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit leave request')
      }
    } catch (error) {
      console.error('Error submitting leave request:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit leave request',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getMinDate = () => {
    const today = new Date()
    if (selectedPolicy?.minAdvanceNotice) {
      return addDays(today, selectedPolicy.minAdvanceNotice)
    }
    return today
  }

  const validateDates = () => {
    const errors: string[] = []

    if (selectedPolicy?.maxConsecutiveDays && calculatedDays > selectedPolicy.maxConsecutiveDays) {
      errors.push(`Maximum ${selectedPolicy.maxConsecutiveDays} consecutive days allowed`)
    }

    if (selectedBalance && calculatedDays > selectedBalance.available) {
      errors.push(`Insufficient balance. Available: ${selectedBalance.available} days`)
    }

    return errors
  }

  const validationErrors = validateDates()

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Leave Details */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Details</CardTitle>
              <CardDescription>
                Select leave type and specify dates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="policyId"
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
                        {policies.map((policy) => {
                          const balance = balances.find(b => b.policy.id === policy.id)
                          return (
                            <SelectItem key={policy.id} value={policy.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{policy.name}</span>
                                {balance && (
                                  <Badge variant="outline" className="ml-2">
                                    {balance.available} days
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedPolicy && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Available Balance:</span>
                      <span className="font-medium">
                        {selectedBalance?.available || 0} days
                      </span>
                    </div>
                    {selectedPolicy.maxConsecutiveDays && (
                      <div className="flex justify-between">
                        <span>Max Consecutive:</span>
                        <span className="font-medium">
                          {selectedPolicy.maxConsecutiveDays} days
                        </span>
                      </div>
                    )}
                    {selectedPolicy.minAdvanceNotice && (
                      <div className="flex justify-between">
                        <span>Min Advance Notice:</span>
                        <span className="font-medium">
                          {selectedPolicy.minAdvanceNotice} days
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Requires Approval:</span>
                      <span className="font-medium">
                        {selectedPolicy.requiresApproval ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="isHalfDay"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Half Day Leave</FormLabel>
                      <FormDescription>
                        Apply for half day leave instead of full day
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

              {watchIsHalfDay && (
                <FormField
                  control={form.control}
                  name="halfDayType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Half Day Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select half day type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FIRST_HALF">First Half</SelectItem>
                          <SelectItem value="SECOND_HALF">Second Half</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < getMinDate()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                              disabled={watchIsHalfDay}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => 
                              date < (watchStartDate || getMinDate()) || 
                              date < getMinDate()
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {calculatedDays > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-900">
                    Total Leave Days: {calculatedDays}
                  </div>
                  {selectedBalance && (
                    <div className="text-sm text-blue-700">
                      Remaining Balance: {selectedBalance.available - calculatedDays} days
                    </div>
                  )}
                </div>
              )}

              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
              <CardDescription>
                Provide reason and emergency contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Leave</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please provide the reason for your leave request"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="handoverNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Handover Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe work handover arrangements (optional)"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Mention any important tasks or responsibilities to be handled
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <Label>Emergency Contact (Optional)</Label>
                
                <FormField
                  control={form.control}
                  name="emergencyContact.name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Emergency contact name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContact.phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Emergency contact phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContact.relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <FormControl>
                        <Input placeholder="Relationship to you" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading || validationErrors.length > 0}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
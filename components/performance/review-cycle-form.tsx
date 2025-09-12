'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format, addDays, addMonths } from 'date-fns'
import { cn } from '@/lib/utils'

const reviewCycleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'PROBATION', 'MID_YEAR', 'PROJECT_BASED']),
  startDate: z.date(),
  endDate: z.date(),
  dueDate: z.date(),
})

type ReviewCycleFormData = z.infer<typeof reviewCycleFormSchema>

interface PerformanceCycle {
  id: string
  name: string
  description?: string
  type: string
  startDate: string
  endDate: string
  dueDate: string
  status: string
}

interface ReviewCycleFormProps {
  cycle?: PerformanceCycle
  onSuccess: () => void
  onCancel: () => void
}

export function ReviewCycleForm({ 
  cycle, 
  onSuccess, 
  onCancel 
}: ReviewCycleFormProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<ReviewCycleFormData>({
    resolver: zodResolver(reviewCycleFormSchema),
    defaultValues: {
      name: cycle?.name || '',
      description: cycle?.description || '',
      type: (cycle?.type as any) || 'ANNUAL',
      startDate: cycle?.startDate ? new Date(cycle.startDate) : new Date(),
      endDate: cycle?.endDate ? new Date(cycle.endDate) : addMonths(new Date(), 12),
      dueDate: cycle?.dueDate ? new Date(cycle.dueDate) : addDays(addMonths(new Date(), 12), 14),
    },
  })

  const selectedType = form.watch('type')
  const startDate = form.watch('startDate')

  // Auto-calculate end date based on type
  const handleTypeChange = (type: string) => {
    form.setValue('type', type as any)
    
    if (startDate) {
      let endDate: Date
      let dueDate: Date
      
      switch (type) {
        case 'QUARTERLY':
          endDate = addMonths(startDate, 3)
          dueDate = addDays(endDate, 14)
          break
        case 'HALF_YEARLY':
          endDate = addMonths(startDate, 6)
          dueDate = addDays(endDate, 21)
          break
        case 'ANNUAL':
          endDate = addMonths(startDate, 12)
          dueDate = addDays(endDate, 30)
          break
        case 'PROBATION':
          endDate = addMonths(startDate, 6)
          dueDate = addDays(endDate, 7)
          break
        case 'MID_YEAR':
          endDate = addMonths(startDate, 6)
          dueDate = addDays(endDate, 14)
          break
        default:
          endDate = addMonths(startDate, 12)
          dueDate = addDays(endDate, 30)
      }
      
      form.setValue('endDate', endDate)
      form.setValue('dueDate', dueDate)
    }
  }

  const onSubmit = async (data: ReviewCycleFormData) => {
    try {
      setLoading(true)

      const payload = {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        dueDate: data.dueDate.toISOString(),
      }

      const url = cycle 
        ? `/api/performance/cycles/${cycle.id}`
        : '/api/performance/cycles'
      
      const method = cycle ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const error = await response.json()
        console.error('Error saving cycle:', error)
      }
    } catch (error) {
      console.error('Error saving cycle:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'QUARTERLY':
        return 'Performance review every 3 months'
      case 'HALF_YEARLY':
        return 'Performance review every 6 months'
      case 'ANNUAL':
        return 'Annual performance review (12 months)'
      case 'PROBATION':
        return 'Probationary period review (typically 3-6 months)'
      case 'MID_YEAR':
        return 'Mid-year performance check-in'
      case 'PROJECT_BASED':
        return 'Project completion review'
      default:
        return ''
    }
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {cycle ? 'Edit Review Cycle' : 'Create Review Cycle'}
          </DialogTitle>
          <DialogDescription>
            {cycle 
              ? 'Update the review cycle details below.'
              : 'Set up a new performance review cycle with timeline and configuration.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cycle Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Q1 2024 Performance Review" {...field} />
                  </FormControl>
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
                      placeholder="Describe the purpose and scope of this review cycle"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Review Type</FormLabel>
                  <Select onValueChange={handleTypeChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select review type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="HALF_YEARLY">Half-Yearly</SelectItem>
                      <SelectItem value="ANNUAL">Annual</SelectItem>
                      <SelectItem value="PROBATION">Probation</SelectItem>
                      <SelectItem value="MID_YEAR">Mid-Year</SelectItem>
                      <SelectItem value="PROJECT_BASED">Project-Based</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {getTypeDescription(selectedType)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick start date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date)
                            if (date && selectedType) {
                              handleTypeChange(selectedType)
                            }
                          }}
                          disabled={(date) =>
                            date < new Date("1900-01-01")
                          }
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
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick end date</span>
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
                            date < startDate
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Review period end
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick due date</span>
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
                            date < form.getValues('endDate')
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Review completion deadline
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : cycle ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
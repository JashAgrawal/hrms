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
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const keyResultFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['QUANTITATIVE', 'QUALITATIVE', 'MILESTONE', 'BINARY']),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  targetDate: z.date().optional(),
  weight: z.number().min(0).max(100),
})

type KeyResultFormData = z.infer<typeof keyResultFormSchema>

interface KeyResult {
  id: string
  title: string
  description?: string
  type: string
  targetValue?: number
  unit?: string
  targetDate?: string
  weight: number
}

interface KeyResultFormProps {
  keyResult?: KeyResult
  objectiveId: string
  onSuccess: () => void
  onCancel: () => void
}

export function KeyResultForm({ 
  keyResult, 
  objectiveId, 
  onSuccess, 
  onCancel 
}: KeyResultFormProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<KeyResultFormData>({
    resolver: zodResolver(keyResultFormSchema),
    defaultValues: {
      title: keyResult?.title || '',
      description: keyResult?.description || '',
      type: (keyResult?.type as any) || 'QUANTITATIVE',
      targetValue: keyResult?.targetValue || undefined,
      unit: keyResult?.unit || '',
      targetDate: keyResult?.targetDate ? new Date(keyResult.targetDate) : undefined,
      weight: keyResult?.weight || 25,
    },
  })

  const selectedType = form.watch('type')

  const onSubmit = async (data: KeyResultFormData) => {
    try {
      setLoading(true)

      const payload = {
        ...data,
        objectiveId,
        targetDate: data.targetDate?.toISOString(),
      }

      const url = keyResult 
        ? `/api/performance/key-results/${keyResult.id}`
        : '/api/performance/key-results'
      
      const method = keyResult ? 'PUT' : 'POST'

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
        console.error('Error saving key result:', error)
      }
    } catch (error) {
      console.error('Error saving key result:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {keyResult ? 'Edit Key Result' : 'Add Key Result'}
          </DialogTitle>
          <DialogDescription>
            {keyResult 
              ? 'Update the key result details below.'
              : 'Define a measurable key result for this objective.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter key result title" {...field} />
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
                      placeholder="Describe how this key result will be measured"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="QUANTITATIVE">Quantitative</SelectItem>
                        <SelectItem value="QUALITATIVE">Qualitative</SelectItem>
                        <SelectItem value="MILESTONE">Milestone</SelectItem>
                        <SelectItem value="BINARY">Binary (Yes/No)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        max="100" 
                        placeholder="25"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedType === 'QUANTITATIVE' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Value</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="100"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        The target numeric value to achieve
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., %, $, users" {...field} />
                      </FormControl>
                      <FormDescription>
                        Unit of measurement
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="targetDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Target Date (Optional)</FormLabel>
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
                            <span>Pick a target date</span>
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
                          date < new Date()
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    When should this key result be achieved?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : keyResult ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
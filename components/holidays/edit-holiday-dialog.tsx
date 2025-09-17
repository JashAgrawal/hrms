'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
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
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface Holiday {
  id: string
  name: string
  date: string
  type: 'PUBLIC' | 'COMPANY' | 'OPTIONAL' | 'RELIGIOUS' | 'NATIONAL'
  description?: string
  isOptional: boolean
  isActive: boolean
  year: number
}

interface EditHolidayDialogProps {
  holiday: Holiday | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onHolidayUpdated: () => void
}

const holidaySchema = z.object({
  name: z.string().min(1, 'Holiday name is required'),
  date: z.date({
    required_error: 'Holiday date is required',
  }),
  type: z.enum(['PUBLIC', 'COMPANY', 'OPTIONAL', 'RELIGIOUS', 'NATIONAL']),
  description: z.string().optional(),
  isOptional: z.boolean(),
  isActive: z.boolean(),
})

type HolidayFormData = z.infer<typeof holidaySchema>

export function EditHolidayDialog({
  holiday,
  open,
  onOpenChange,
  onHolidayUpdated,
}: EditHolidayDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const form = useForm<HolidayFormData>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      name: '',
      date: new Date(),
      type: 'COMPANY',
      description: '',
      isOptional: false,
      isActive: true,
    },
  })

  // Reset form when holiday changes
  useEffect(() => {
    if (holiday) {
      form.reset({
        name: holiday.name,
        date: new Date(holiday.date),
        type: holiday.type,
        description: holiday.description || '',
        isOptional: holiday.isOptional,
        isActive: holiday.isActive,
      })
    }
  }, [holiday, form])

  const onSubmit = async (data: HolidayFormData) => {
    if (!holiday) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/holidays/${holiday.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          date: format(data.date, 'yyyy-MM-dd'),
          year: data.date.getFullYear(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update holiday')
      }

      toast({
        title: 'Success',
        description: 'Holiday updated successfully',
      })

      onHolidayUpdated()
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating holiday:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update holiday',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Holiday</DialogTitle>
          <DialogDescription>
            Update the holiday information below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Holiday Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter holiday name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
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
                        disabled={(date) =>
                          date < new Date('1900-01-01')
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select holiday type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Public Holiday</SelectItem>
                      <SelectItem value="COMPANY">Company Holiday</SelectItem>
                      <SelectItem value="OPTIONAL">Optional Holiday</SelectItem>
                      <SelectItem value="RELIGIOUS">Religious Holiday</SelectItem>
                      <SelectItem value="NATIONAL">National Holiday</SelectItem>
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
                      placeholder="Enter holiday description (optional)"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-4">
              <FormField
                control={form.control}
                name="isOptional"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Optional Holiday</FormLabel>
                      <FormDescription>
                        Employees can choose to take this holiday
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
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Whether this holiday is currently active
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Holiday
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

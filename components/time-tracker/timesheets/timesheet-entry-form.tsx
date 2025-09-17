'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calendar, Clock, Plus, Trash2, Save, Send, ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Validation schema
const TimeEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakDuration: z.number().min(0).max(480), // Max 8 hours break
  projectId: z.string().optional(),
  taskDescription: z.string().optional(),
  billableHours: z.number().min(0).max(24),
  nonBillableHours: z.number().min(0).max(24),
  overtimeHours: z.number().min(0).max(24),
})

const TimesheetFormSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(TimeEntrySchema)
})

type TimesheetFormData = z.infer<typeof TimesheetFormSchema>
type TimeEntry = z.infer<typeof TimeEntrySchema>

interface Project {
  id: string
  name: string
  code: string
  clientName?: string
}

interface TimesheetEntryFormProps {
  initialData?: {
    id?: string
    startDate: string
    endDate: string
    entries: TimeEntry[]
    status?: string
  }
  projects: Project[]
  onSave: (data: TimesheetFormData, isDraft: boolean) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  readonly?: boolean
}

export function TimesheetEntryForm({
  initialData,
  projects,
  onSave,
  onCancel,
  isLoading = false,
  readonly = false
}: TimesheetEntryFormProps) {
  const { toast } = useToast()
  const [currentWeek, setCurrentWeek] = useState(new Date())

  // Calculate week dates
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }) // Sunday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const form = useForm<TimesheetFormData>({
    resolver: zodResolver(TimesheetFormSchema),
    defaultValues: {
      startDate: format(weekStart, 'yyyy-MM-dd'),
      endDate: format(weekEnd, 'yyyy-MM-dd'),
      entries: weekDays.map(day => ({
        date: format(day, 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '17:00',
        breakDuration: 60,
        projectId: '',
        taskDescription: '',
        billableHours: 8,
        nonBillableHours: 0,
        overtimeHours: 0,
      }))
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'entries'
  })

  // Load initial data
  useEffect(() => {
    if (initialData) {
      form.reset({
        startDate: initialData.startDate,
        endDate: initialData.endDate,
        entries: initialData.entries
      })
      // Set current week based on initial data
      setCurrentWeek(new Date(initialData.startDate))
    }
  }, [initialData, form])

  // Update form when week changes
  useEffect(() => {
    if (!initialData) {
      const newStartDate = format(weekStart, 'yyyy-MM-dd')
      const newEndDate = format(weekEnd, 'yyyy-MM-dd')
      
      form.setValue('startDate', newStartDate)
      form.setValue('endDate', newEndDate)
      
      // Update entries for new week
      const newEntries = weekDays.map(day => ({
        date: format(day, 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '17:00',
        breakDuration: 60,
        projectId: '',
        taskDescription: '',
        billableHours: 8,
        nonBillableHours: 0,
        overtimeHours: 0,
      }))
      
      form.setValue('entries', newEntries)
    }
  }, [currentWeek, initialData, form])

  // Calculate hours based on time range
  const calculateHours = (startTime: string, endTime: string, breakDuration: number) => {
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    let totalMinutes = endMinutes - startMinutes
    if (totalMinutes < 0) totalMinutes += 24 * 60 // Handle overnight
    
    totalMinutes -= breakDuration
    return Math.max(0, totalMinutes / 60)
  }

  // Auto-calculate billable hours when time changes
  const handleTimeChange = (index: number, field: 'startTime' | 'endTime' | 'breakDuration', value: string | number) => {
    const entry = form.getValues(`entries.${index}`)
    const updatedEntry = { ...entry, [field]: value }
    
    if (field === 'startTime' || field === 'endTime' || field === 'breakDuration') {
      const calculatedHours = calculateHours(
        updatedEntry.startTime,
        updatedEntry.endTime,
        updatedEntry.breakDuration
      )
      
      // Update billable hours if it's currently equal to calculated hours
      if (entry.billableHours === calculateHours(entry.startTime, entry.endTime, entry.breakDuration)) {
        form.setValue(`entries.${index}.billableHours`, calculatedHours)
      }
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (readonly || initialData) return
    
    const newWeek = direction === 'prev' 
      ? subDays(currentWeek, 7)
      : addDays(currentWeek, 7)
    setCurrentWeek(newWeek)
  }

  const addEntry = () => {
    append({
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '17:00',
      breakDuration: 60,
      projectId: '',
      taskDescription: '',
      billableHours: 8,
      nonBillableHours: 0,
      overtimeHours: 0,
    })
  }

  const handleSave = async (isDraft: boolean) => {
    try {
      const data = form.getValues()
      await onSave(data, isDraft)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save timesheet',
        variant: 'destructive'
      })
    }
  }

  const totalHours = fields.reduce((sum, _, index) => {
    const entry = form.watch(`entries.${index}`)
    return sum + (entry?.billableHours || 0) + (entry?.nonBillableHours || 0) + (entry?.overtimeHours || 0)
  }, 0)

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timesheet Entry
          </CardTitle>
          <div className="flex items-center gap-2">
            {!readonly && !initialData && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                  disabled={isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[200px] text-center">
                  {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('next')}
                  disabled={isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {initialData && (
              <Badge variant={
                initialData.status === 'APPROVED' ? 'default' :
                initialData.status === 'SUBMITTED' ? 'secondary' :
                initialData.status === 'REJECTED' ? 'destructive' : 'outline'
              }>
                {initialData.status}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Total Hours: {totalHours.toFixed(2)}</span>
          <span>Period: {form.watch('startDate')} to {form.watch('endDate')}</span>
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <div className="space-y-4">
            {fields.map((field, index) => {
              const entryDate = new Date(form.watch(`entries.${index}.date`))
              const dayName = format(entryDate, 'EEEE')
              const isWeekend = entryDate.getDay() === 0 || entryDate.getDay() === 6

              return (
                <Card key={field.id} className={`${isWeekend ? 'bg-muted/30' : ''}`}>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      {/* Date */}
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`entries.${index}.date`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">
                                {dayName}
                                {isWeekend && <span className="text-muted-foreground"> (Weekend)</span>}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  disabled={readonly}
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Time Range */}
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`entries.${index}.startTime`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Start Time</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  disabled={readonly}
                                  onChange={(e) => {
                                    field.onChange(e)
                                    handleTimeChange(index, 'startTime', e.target.value)
                                  }}
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`entries.${index}.endTime`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">End Time</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  disabled={readonly}
                                  onChange={(e) => {
                                    field.onChange(e)
                                    handleTimeChange(index, 'endTime', e.target.value)
                                  }}
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Break Duration */}
                      <div className="md:col-span-1">
                        <FormField
                          control={form.control}
                          name={`entries.${index}.breakDuration`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Break (min)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="480"
                                  {...field}
                                  disabled={readonly}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0
                                    field.onChange(value)
                                    handleTimeChange(index, 'breakDuration', value)
                                  }}
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Project */}
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`entries.${index}.projectId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Project</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                disabled={readonly}
                              >
                                <FormControl>
                                  <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Select project" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="">No Project</SelectItem>
                                  {projects.map((project) => (
                                    <SelectItem key={project.id} value={project.id}>
                                      <div className="flex flex-col">
                                        <span>{project.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {project.code} {project.clientName && `• ${project.clientName}`}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Hours */}
                      <div className="md:col-span-1">
                        <FormField
                          control={form.control}
                          name={`entries.${index}.billableHours`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Billable</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max="24"
                                  {...field}
                                  disabled={readonly}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-1">
                        <FormField
                          control={form.control}
                          name={`entries.${index}.nonBillableHours`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Non-Bill</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max="24"
                                  {...field}
                                  disabled={readonly}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-1">
                        <FormField
                          control={form.control}
                          name={`entries.${index}.overtimeHours`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Overtime</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max="24"
                                  {...field}
                                  disabled={readonly}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Actions */}
                      {!readonly && (
                        <div className="md:col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Task Description */}
                    <div className="mt-3">
                      <FormField
                        control={form.control}
                        name={`entries.${index}.taskDescription`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Task Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe the work performed..."
                                {...field}
                                disabled={readonly}
                                className="text-sm min-h-[60px]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {!readonly && (
              <Button
                type="button"
                variant="outline"
                onClick={addEntry}
                className="w-full"
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            )}
          </div>

          {!readonly && (
            <>
              <Separator className="my-6" />
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSave(true)}
                    disabled={isLoading}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={isLoading}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit
                  </Button>
                </div>
              </div>
            </>
          )}
        </Form>
      </CardContent>
    </Card>
  )
}

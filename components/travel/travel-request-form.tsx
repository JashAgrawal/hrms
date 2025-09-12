'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { 
  CalendarIcon, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Plane,
  Train,
  Bus,
  Car,
  MapPin,
  Clock,
  DollarSign
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const travelRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  purpose: z.string().min(1, 'Purpose is required').max(500, 'Purpose too long'),
  destination: z.string().min(1, 'Destination is required'),
  fromLocation: z.string().min(1, 'From location is required'),
  startDate: z.date({
    required_error: 'Start date is required',
  }),
  endDate: z.date({
    required_error: 'End date is required',
  }),
  estimatedCost: z.number().positive('Estimated cost must be positive'),
  travelMode: z.enum(['FLIGHT', 'TRAIN', 'BUS', 'CAR', 'TAXI', 'OTHER']),
  accommodationRequired: z.boolean(),
  advanceRequired: z.boolean(),
  advanceAmount: z.number().optional(),
  itinerary: z.array(z.object({
    date: z.date(),
    location: z.string().min(1, 'Location is required'),
    activity: z.string().min(1, 'Activity is required'),
    estimatedCost: z.number().optional(),
    notes: z.string().optional(),
  })).optional(),
}).refine((data) => {
  return data.endDate >= data.startDate
}, {
  message: "End date must be after start date",
  path: ["endDate"],
}).refine((data) => {
  if (data.advanceRequired && !data.advanceAmount) {
    return false
  }
  return true
}, {
  message: "Advance amount is required when advance is requested",
  path: ["advanceAmount"],
})

type TravelRequestFormData = z.infer<typeof travelRequestSchema>

interface PolicyValidation {
  isCompliant: boolean
  requiresApproval: boolean
  violations: string[]
  warnings: string[]
  recommendations: string[]
  policyDetails: {
    employeeGrade: string
    costLimits: {
      domestic: number
      international: number
    }
    maxAdvancePercentage: number
    minAdvanceNoticeDays: number
    monthlyBudget: number
    currentMonthSpend: number
  }
}

interface TravelRequestFormProps {
  onSubmit: (data: TravelRequestFormData) => Promise<void>
  onCancel: () => void
  initialData?: Partial<TravelRequestFormData>
  isLoading?: boolean
}

const travelModeIcons = {
  FLIGHT: Plane,
  TRAIN: Train,
  BUS: Bus,
  CAR: Car,
  TAXI: Car,
  OTHER: MapPin,
}

export function TravelRequestForm({ 
  onSubmit, 
  onCancel, 
  initialData, 
  isLoading = false 
}: TravelRequestFormProps) {
  const [policyValidation, setPolicyValidation] = useState<PolicyValidation | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)

  const form = useForm<TravelRequestFormData>({
    resolver: zodResolver(travelRequestSchema),
    defaultValues: {
      startDate: new Date(),
      endDate: new Date(),
      travelMode: 'FLIGHT',
      accommodationRequired: false,
      advanceRequired: false,
      itinerary: [],
      ...initialData,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'itinerary',
  })

  const watchedValues = form.watch()

  // Validate policy when key fields change
  useEffect(() => {
    const validatePolicy = async () => {
      if (!watchedValues.destination || !watchedValues.startDate || !watchedValues.endDate || !watchedValues.estimatedCost) {
        return
      }

      setValidationLoading(true)
      try {
        const response = await fetch('/api/travel-requests/policy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destination: watchedValues.destination,
            startDate: watchedValues.startDate.toISOString(),
            endDate: watchedValues.endDate.toISOString(),
            estimatedCost: watchedValues.estimatedCost,
            travelMode: watchedValues.travelMode,
            advanceRequired: watchedValues.advanceRequired,
            advanceAmount: watchedValues.advanceAmount,
          }),
        })

        if (response.ok) {
          const validation = await response.json()
          setPolicyValidation(validation)
        }
      } catch (error) {
        console.error('Error validating policy:', error)
      } finally {
        setValidationLoading(false)
      }
    }

    const timeoutId = setTimeout(validatePolicy, 500) // Debounce
    return () => clearTimeout(timeoutId)
  }, [
    watchedValues.destination,
    watchedValues.startDate,
    watchedValues.endDate,
    watchedValues.estimatedCost,
    watchedValues.travelMode,
    watchedValues.advanceRequired,
    watchedValues.advanceAmount,
  ])

  const addItineraryItem = () => {
    append({
      date: watchedValues.startDate || new Date(),
      location: '',
      activity: '',
      estimatedCost: 0,
      notes: '',
    })
  }

  const handleSubmit = async (data: TravelRequestFormData) => {
    await onSubmit(data)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Travel Request
          </CardTitle>
          <CardDescription>
            Submit a new travel request with detailed itinerary and cost estimation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Client Meeting in Mumbai" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Controller
                  control={form.control}
                  name="travelMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Travel Mode</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select travel mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(travelModeIcons).map(([mode, Icon]) => (
                            <SelectItem key={mode} value={mode}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {mode.charAt(0) + mode.slice(1).toLowerCase()}
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

              <Controller
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the purpose of your travel..."
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location and Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  control={form.control}
                  name="fromLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Bangalore" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Controller
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Mumbai" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
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
                              date < new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Controller
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
                              date < watchedValues.startDate || date < new Date("1900-01-01")
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

              {/* Cost and Advance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  control={form.control}
                  name="estimatedCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Cost (₹)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <Controller
                    control={form.control}
                    name="accommodationRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Accommodation Required</FormLabel>
                          <FormDescription>
                            Will you need hotel accommodation?
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
              </div>

              {/* Advance Request */}
              <div className="space-y-4">
                <Controller
                  control={form.control}
                  name="advanceRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Advance Required</FormLabel>
                        <FormDescription>
                          Do you need travel advance?
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

                {watchedValues.advanceRequired && (
                  <Controller
                    control={form.control}
                    name="advanceAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Advance Amount (₹)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum 50% of estimated cost
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Policy Validation */}
              {policyValidation && (
                <Card className={cn(
                  "border-l-4",
                  policyValidation.violations.length > 0 
                    ? "border-l-red-500 bg-red-50" 
                    : policyValidation.warnings.length > 0
                    ? "border-l-yellow-500 bg-yellow-50"
                    : "border-l-green-500 bg-green-50"
                )}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {policyValidation.violations.length > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : policyValidation.warnings.length > 0 ? (
                        <Info className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      Policy Validation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {policyValidation.violations.length > 0 && (
                      <div>
                        <h4 className="font-medium text-red-800 mb-2">Policy Violations</h4>
                        <ul className="space-y-1">
                          {policyValidation.violations.map((violation, index) => (
                            <li key={index} className="text-sm text-red-700 flex items-start gap-2">
                              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              {violation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {policyValidation.warnings.length > 0 && (
                      <div>
                        <h4 className="font-medium text-yellow-800 mb-2">Warnings</h4>
                        <ul className="space-y-1">
                          {policyValidation.warnings.map((warning, index) => (
                            <li key={index} className="text-sm text-yellow-700 flex items-start gap-2">
                              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {policyValidation.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium text-blue-800 mb-2">Recommendations</h4>
                        <ul className="space-y-1">
                          {policyValidation.recommendations.map((recommendation, index) => (
                            <li key={index} className="text-sm text-blue-700 flex items-start gap-2">
                              <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              {recommendation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div className="text-sm">
                        <span className="font-medium">Your Grade:</span> {policyValidation.policyDetails.employeeGrade}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Monthly Budget:</span> ₹{policyValidation.policyDetails.monthlyBudget.toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Itinerary */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Itinerary (Optional)</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItineraryItem}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Day {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Controller
                        control={form.control}
                        name={`itinerary.${index}.date`}
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Date</FormLabel>
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
                                    date < watchedValues.startDate || 
                                    date > watchedValues.endDate
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Controller
                        control={form.control}
                        name={`itinerary.${index}.location`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Client Office" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Controller
                        control={form.control}
                        name={`itinerary.${index}.activity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Activity</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Client Meeting" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Controller
                        control={form.control}
                        name={`itinerary.${index}.estimatedCost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estimated Cost (₹)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Controller
                      control={form.control}
                      name={`itinerary.${index}.notes`}
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Additional notes for this day..."
                              className="min-h-[60px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </Card>
                ))}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-4 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || validationLoading}
                >
                  {isLoading ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
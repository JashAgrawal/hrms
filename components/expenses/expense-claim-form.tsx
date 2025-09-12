'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import { CalendarIcon, Upload, MapPin, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const expenseClaimSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  expenseDate: z.date({
    required_error: 'Expense date is required',
  }),
  merchantName: z.string().optional(),
  merchantAddress: z.string().optional(),
  billNumber: z.string().optional(),
  taxAmount: z.number().optional(),
  taxRate: z.number().optional(),
  distanceTraveled: z.number().optional(),
  vehicleNumber: z.string().optional(),
  travelRequestId: z.string().optional(),
})

type ExpenseClaimFormData = z.infer<typeof expenseClaimSchema>

interface ExpenseCategory {
  id: string
  name: string
  code: string
  maxAmount?: number
  requiresReceipt: boolean
  requiresApproval: boolean
  approvalLevels: number
  isActive: boolean
}

interface AttachmentFile {
  id?: string
  file: File
  name: string
  size: number
  type: string
  preview?: string
}

interface ExpenseClaimFormProps {
  onSubmit: (data: ExpenseClaimFormData, attachments: AttachmentFile[]) => Promise<void>
  onCancel: () => void
  initialData?: Partial<ExpenseClaimFormData>
  isLoading?: boolean
}

export function ExpenseClaimForm({ 
  onSubmit, 
  onCancel, 
  initialData, 
  isLoading = false 
}: ExpenseClaimFormProps) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null)
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [policyViolations, setPolicyViolations] = useState<string[]>([])

  const form = useForm<ExpenseClaimFormData>({
    resolver: zodResolver(expenseClaimSchema),
    defaultValues: {
      expenseDate: new Date(),
      ...initialData,
    },
  })

  const watchedAmount = form.watch('amount')
  const watchedCategoryId = form.watch('categoryId')

  // Fetch expense categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/expenses/categories')
        if (response.ok) {
          const data = await response.json()
          setCategories(data.filter((cat: ExpenseCategory) => cat.isActive))
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }

    fetchCategories()
  }, [])

  // Update selected category when category changes
  useEffect(() => {
    if (watchedCategoryId) {
      const category = categories.find(cat => cat.id === watchedCategoryId)
      setSelectedCategory(category || null)
    }
  }, [watchedCategoryId, categories])

  // Validate policy rules when amount or category changes
  useEffect(() => {
    if (selectedCategory && watchedAmount) {
      const violations: string[] = []
      
      if (selectedCategory.maxAmount && watchedAmount > selectedCategory.maxAmount) {
        violations.push(`Amount exceeds maximum limit of ₹${selectedCategory.maxAmount.toLocaleString()}`)
      }
      
      setPolicyViolations(violations)
    } else {
      setPolicyViolations([])
    }
  }, [selectedCategory, watchedAmount])

  // Get current GPS location
  const getCurrentLocation = async () => {
    setLocationLoading(true)
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser')
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        })
      })

      const { latitude, longitude } = position.coords
      
      // Reverse geocoding to get address
      try {
        const response = await fetch(
          `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${process.env.NEXT_PUBLIC_OPENCAGE_API_KEY}`
        )
        const data = await response.json()
        const address = data.results?.[0]?.formatted || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        
        setGpsLocation({ latitude, longitude, address })
      } catch (geocodeError) {
        setGpsLocation({ latitude, longitude, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` })
      }
    } catch (error) {
      console.error('Error getting location:', error)
      alert('Unable to get current location. Please ensure location permissions are enabled.')
    } finally {
      setLocationLoading(false)
    }
  }

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    files.forEach(file => {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        alert(`File type ${file.type} is not allowed. Please upload JPEG, PNG, or PDF files.`)
        return
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 5MB.`)
        return
      }

      const newAttachment: AttachmentFile = {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      }

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          newAttachment.preview = e.target?.result as string
          setAttachments(prev => [...prev, newAttachment])
        }
        reader.readAsDataURL(file)
      } else {
        setAttachments(prev => [...prev, newAttachment])
      }
    })

    // Reset input
    event.target.value = ''
  }

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Handle form submission
  const handleSubmit = async (data: ExpenseClaimFormData) => {
    // Validate required attachments
    if (selectedCategory?.requiresReceipt && attachments.length === 0) {
      alert('Receipt is required for this expense category')
      return
    }

    // Add GPS location to form data if available
    const formDataWithLocation = {
      ...data,
      location: gpsLocation,
    }

    await onSubmit(formDataWithLocation, attachments)
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Submit Expense Claim</CardTitle>
        <CardDescription>
          Fill in the details of your expense claim. All fields marked with * are required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expense Category *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{category.name}</span>
                              {category.maxAmount && (
                                <Badge variant="outline" className="ml-2">
                                  Max: ₹{category.maxAmount.toLocaleString()}
                                </Badge>
                              )}
                            </div>
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₹) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Policy Violations Alert */}
            {policyViolations.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Policy Violations Detected:</p>
                    {policyViolations.map((violation, index) => (
                      <p key={index} className="text-sm">• {violation}</p>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of expense" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expense Date *</FormLabel>
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
                            date > new Date() || date < new Date("1900-01-01")
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed description of the expense"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Merchant Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Merchant Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="merchantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Merchant Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Name of the merchant/vendor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="billNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill/Invoice Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Bill or invoice number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="merchantAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Merchant Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Address of the merchant/vendor"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tax Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Tax Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Amount (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Travel Information (if applicable) */}
            {selectedCategory?.code === 'TRAVEL' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Travel Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="distanceTraveled"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distance Traveled (km)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vehicleNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Vehicle registration number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* GPS Location */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Location Information</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={getCurrentLocation}
                  disabled={locationLoading}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {locationLoading ? 'Getting Location...' : 'Get Current Location'}
                </Button>
              </div>
              
              {gpsLocation && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Location Captured:</p>
                      <p className="text-sm">{gpsLocation.address}</p>
                      <p className="text-xs text-muted-foreground">
                        Coordinates: {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* File Attachments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Attachments {selectedCategory?.requiresReceipt && <span className="text-red-500">*</span>}
                </h3>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button type="button" variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                </div>
              </div>

              {selectedCategory?.requiresReceipt && (
                <p className="text-sm text-muted-foreground">
                  Receipt is required for this expense category. Accepted formats: JPEG, PNG, PDF (max 5MB each)
                </p>
              )}

              {attachments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attachments.map((attachment, index) => (
                    <div key={index} className="relative border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(attachment.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {attachment.preview && (
                        <div className="mt-2">
                          <img
                            src={attachment.preview}
                            alt={attachment.name}
                            className="w-full h-20 object-cover rounded"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Submitting...' : 'Submit Expense Claim'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
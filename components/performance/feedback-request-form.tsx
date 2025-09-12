'use client'

import { useState, useEffect } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const feedbackRequestSchema = z.object({
  reviewerId: z.string().cuid(),
  reviewerType: z.enum(['MANAGER', 'PEER', 'SUBORDINATE', 'EXTERNAL', 'SKIP_LEVEL']),
  relationship: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  dueDate: z.date().optional(),
})

type FeedbackRequestData = z.infer<typeof feedbackRequestSchema>

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  designation: string
  department: {
    name: string
  }
}

interface FeedbackRequestFormProps {
  employeeId?: string
  reviewId?: string
  onSuccess: () => void
  onCancel: () => void
}

export function FeedbackRequestForm({ 
  employeeId, 
  reviewId, 
  onSuccess, 
  onCancel 
}: FeedbackRequestFormProps) {
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [bulkMode, setBulkMode] = useState(false)

  const form = useForm<FeedbackRequestData>({
    resolver: zodResolver(feedbackRequestSchema),
    defaultValues: {
      reviewerId: '',
      reviewerType: 'PEER',
      relationship: '',
      isAnonymous: false,
      dueDate: undefined,
    },
  })

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees?limit=100')
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees)
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const onSubmit = async (data: FeedbackRequestData) => {
    try {
      setLoading(true)

      const reviewersToProcess = bulkMode ? selectedEmployees : [data.reviewerId]
      
      const requests = reviewersToProcess.map(reviewerId => ({
        ...data,
        reviewerId,
        employeeId,
        reviewId,
        dueDate: data.dueDate?.toISOString(),
      }))

      // Create feedback requests
      const promises = requests.map(request =>
        fetch('/api/performance/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        })
      )

      const responses = await Promise.all(promises)
      const allSuccessful = responses.every(response => response.ok)

      if (allSuccessful) {
        onSuccess()
      } else {
        console.error('Some feedback requests failed')
      }
    } catch (error) {
      console.error('Error creating feedback requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const getReviewerTypeDescription = (type: string) => {
    switch (type) {
      case 'MANAGER':
        return 'Direct manager or supervisor'
      case 'PEER':
        return 'Colleague at the same level'
      case 'SUBORDINATE':
        return 'Direct report or team member'
      case 'EXTERNAL':
        return 'External stakeholder or client'
      case 'SKIP_LEVEL':
        return 'Manager\'s manager'
      default:
        return ''
    }
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Feedback</DialogTitle>
          <DialogDescription>
            Request feedback from colleagues for performance evaluation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bulk Mode Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="bulk-mode"
              checked={bulkMode}
              onCheckedChange={(checked) => setBulkMode(checked === true)}
            />
            <label htmlFor="bulk-mode" className="text-sm font-medium">
              Request feedback from multiple people
            </label>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!bulkMode ? (
                <FormField
                  control={form.control}
                  name="reviewerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Reviewer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a reviewer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.firstName} {employee.lastName} - {employee.designation}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Reviewers</label>
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                    {employees.map((employee) => (
                      <div key={employee.id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          id={employee.id}
                          checked={selectedEmployees.includes(employee.id)}
                          onCheckedChange={() => handleEmployeeToggle(employee.id)}
                        />
                        <label htmlFor={employee.id} className="text-sm flex-1 cursor-pointer">
                          {employee.firstName} {employee.lastName} - {employee.designation}
                          <span className="text-gray-500 ml-2">({employee.department.name})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedEmployees.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      {selectedEmployees.length} reviewer(s) selected
                    </p>
                  )}
                </div>
              )}

              <FormField
                control={form.control}
                name="reviewerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reviewer Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reviewer type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="PEER">Peer</SelectItem>
                        <SelectItem value="SUBORDINATE">Subordinate</SelectItem>
                        <SelectItem value="EXTERNAL">External</SelectItem>
                        <SelectItem value="SKIP_LEVEL">Skip Level</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {getReviewerTypeDescription(form.watch('reviewerType'))}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Working Relationship (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Project collaborator, Team lead, Client contact"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Describe how you work together
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
                    <FormLabel>Due Date (Optional)</FormLabel>
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
                              <span>Set a due date</span>
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
                      When should the feedback be provided?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isAnonymous"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Anonymous Feedback
                      </FormLabel>
                      <FormDescription>
                        The reviewer's identity will be hidden from you
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading || (bulkMode && selectedEmployees.length === 0)}
                >
                  {loading ? 'Sending...' : 'Send Request'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
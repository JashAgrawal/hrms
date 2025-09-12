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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Star, User, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const feedbackFormSchema = z.object({
  overallRating: z.number().min(1).max(5),
  strengths: z.string().min(1, 'Please provide at least one strength'),
  improvements: z.string().min(1, 'Please provide at least one area for improvement'),
  comments: z.string().optional(),
  responses: z.record(z.any()).optional(),
})

type FeedbackFormData = z.infer<typeof feedbackFormSchema>

interface Feedback {
  id: string
  reviewerType: string
  relationship?: string
  isAnonymous: boolean
  status: string
  overallRating?: number
  strengths?: string
  improvements?: string
  comments?: string
  employee: {
    firstName: string
    lastName: string
    employeeCode: string
    designation: string
  }
  reviewer: {
    firstName: string
    lastName: string
    employeeCode: string
    designation: string
  }
  dueDate?: string
}

interface FeedbackFormProps {
  feedback: Feedback
  onSuccess: () => void
  onCancel: () => void
}

export function FeedbackForm({ feedback, onSuccess, onCancel }: FeedbackFormProps) {
  const [loading, setLoading] = useState(false)
  const [template, setTemplate] = useState<any>(null)

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      overallRating: feedback.overallRating || 3,
      strengths: feedback.strengths || '',
      improvements: feedback.improvements || '',
      comments: feedback.comments || '',
      responses: {},
    },
  })

  const isReadOnly = feedback.status === 'SUBMITTED'

  useEffect(() => {
    // Fetch feedback template for this reviewer type
    fetchTemplate()
  }, [feedback.reviewerType])

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/performance/feedback-templates?reviewerType=${feedback.reviewerType}&isActive=true`)
      if (response.ok) {
        const data = await response.json()
        if (data.templates.length > 0) {
          setTemplate(data.templates[0])
        }
      }
    } catch (error) {
      console.error('Error fetching feedback template:', error)
    }
  }

  const onSubmit = async (data: FeedbackFormData) => {
    if (isReadOnly) return

    try {
      setLoading(true)

      const payload = {
        ...data,
        status: 'SUBMITTED',
      }

      const response = await fetch(`/api/performance/feedback/${feedback.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const error = await response.json()
        console.error('Error submitting feedback:', error)
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  const StarRating = ({ value, onChange, readOnly = false }: { 
    value: number
    onChange?: (value: number) => void
    readOnly?: boolean 
  }) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(star)}
            className={cn(
              "p-1 rounded transition-colors",
              !readOnly && "hover:bg-gray-100",
              readOnly && "cursor-default"
            )}
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                star <= value
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              )}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-600">
          {value}/5
        </span>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getReviewerTypeColor = (type: string) => {
    switch (type) {
      case 'MANAGER':
        return 'bg-purple-100 text-purple-800'
      case 'PEER':
        return 'bg-blue-100 text-blue-800'
      case 'SUBORDINATE':
        return 'bg-green-100 text-green-800'
      case 'SELF':
        return 'bg-orange-100 text-orange-800'
      case 'EXTERNAL':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isReadOnly ? 'View Feedback' : 'Provide Feedback'}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly 
              ? 'Review the submitted feedback'
              : `Provide feedback for ${feedback.employee.firstName} ${feedback.employee.lastName}`
            }
          </DialogDescription>
        </DialogHeader>

        {/* Employee Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {feedback.employee.firstName} {feedback.employee.lastName}
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    {feedback.employee.designation} • {feedback.employee.employeeCode}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getReviewerTypeColor(feedback.reviewerType)}>
                  {feedback.reviewerType.replace('_', ' ')}
                </Badge>
                {feedback.dueDate && (
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    Due: {formatDate(feedback.dueDate)}
                  </div>
                )}
              </div>
            </div>
            {feedback.relationship && (
              <p className="text-sm text-gray-600 mt-2">
                Working relationship: {feedback.relationship}
              </p>
            )}
          </CardHeader>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Overall Rating */}
            <FormField
              control={form.control}
              name="overallRating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Overall Rating</FormLabel>
                  <FormControl>
                    <StarRating
                      value={field.value}
                      onChange={field.onChange}
                      readOnly={isReadOnly}
                    />
                  </FormControl>
                  <FormDescription>
                    Rate the overall performance on a scale of 1-5
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Template Questions */}
            {template && template.questions && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Feedback Questions</h3>
                {template.questions.map((question: any, index: number) => (
                  <div key={question.id} className="space-y-2">
                    <label className="text-sm font-medium">
                      {index + 1}. {question.question}
                      {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {question.type === 'RATING' && (
                      <StarRating
                        value={form.watch(`responses.${question.id}`) || 3}
                        onChange={(value) => form.setValue(`responses.${question.id}`, value)}
                        readOnly={isReadOnly}
                      />
                    )}
                    {question.type === 'TEXT' && (
                      <Textarea
                        placeholder="Enter your response..."
                        value={form.watch(`responses.${question.id}`) || ''}
                        onChange={(e) => form.setValue(`responses.${question.id}`, e.target.value)}
                        readOnly={isReadOnly}
                        rows={3}
                      />
                    )}
                    {question.category && (
                      <p className="text-xs text-gray-500">Category: {question.category}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Strengths */}
            <FormField
              control={form.control}
              name="strengths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Strengths</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What are their key strengths and positive qualities?"
                      rows={4}
                      readOnly={isReadOnly}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Highlight their strongest skills and positive contributions
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Areas for Improvement */}
            <FormField
              control={form.control}
              name="improvements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Areas for Improvement</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What areas could they focus on for development?"
                      rows={4}
                      readOnly={isReadOnly}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Provide constructive suggestions for growth and development
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Additional Comments */}
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Comments (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional feedback or context you'd like to provide?"
                      rows={3}
                      readOnly={isReadOnly}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Share any other observations or recommendations
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <Button type="submit" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
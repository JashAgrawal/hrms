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
import { Slider } from '@/components/ui/slider'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const updateFormSchema = z.object({
  progress: z.number().min(0).max(100),
  comments: z.string().optional(),
  challenges: z.string().optional(),
  nextSteps: z.string().optional(),
  updateDate: z.date(),
})

type UpdateFormData = z.infer<typeof updateFormSchema>

interface Objective {
  id: string
  title: string
  progress: number
}

interface ObjectiveUpdateFormProps {
  objective: Objective
  onSuccess: () => void
  onCancel: () => void
}

export function ObjectiveUpdateForm({ 
  objective, 
  onSuccess, 
  onCancel 
}: ObjectiveUpdateFormProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<UpdateFormData>({
    resolver: zodResolver(updateFormSchema),
    defaultValues: {
      progress: objective.progress,
      comments: '',
      challenges: '',
      nextSteps: '',
      updateDate: new Date(),
    },
  })

  const currentProgress = form.watch('progress')

  const onSubmit = async (data: UpdateFormData) => {
    try {
      setLoading(true)

      // First, update the objective progress
      const objectiveResponse = await fetch(`/api/performance/objectives/${objective.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          progress: data.progress,
        }),
      })

      if (!objectiveResponse.ok) {
        throw new Error('Failed to update objective progress')
      }

      // Then, create the progress update record
      const updatePayload = {
        objectiveId: objective.id,
        progress: data.progress,
        comments: data.comments,
        challenges: data.challenges,
        nextSteps: data.nextSteps,
        updateDate: data.updateDate.toISOString(),
      }

      const updateResponse = await fetch('/api/performance/objective-updates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      })

      if (updateResponse.ok) {
        onSuccess()
      } else {
        const error = await updateResponse.json()
        console.error('Error creating progress update:', error)
      }
    } catch (error) {
      console.error('Error updating objective:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'text-green-600'
    if (progress >= 70) return 'text-blue-600'
    if (progress >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getProgressLabel = (progress: number) => {
    if (progress >= 90) return 'Excellent Progress'
    if (progress >= 70) return 'Good Progress'
    if (progress >= 50) return 'Moderate Progress'
    if (progress >= 25) return 'Some Progress'
    return 'Just Started'
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Progress</DialogTitle>
          <DialogDescription>
            Update the progress for "{objective.title}"
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="progress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Progress</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Slider
                        value={[field.value]}
                        onValueChange={(value: number[]) => field.onChange(value[0])}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                      <div className="flex items-center justify-between">
                        <span className={`text-2xl font-bold ${getProgressColor(currentProgress)}`}>
                          {currentProgress}%
                        </span>
                        <span className={`text-sm ${getProgressColor(currentProgress)}`}>
                          {getProgressLabel(currentProgress)}
                        </span>
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Drag the slider to update your progress percentage
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="updateDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Update Date</FormLabel>
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

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What progress have you made? What have you accomplished?"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Describe the progress made and key accomplishments
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="challenges"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Challenges</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What challenges or obstacles have you encountered?"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Describe any challenges or roadblocks
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nextSteps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Steps</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What are your next steps to continue progress?"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Outline your planned next steps
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
                {loading ? 'Updating...' : 'Update Progress'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
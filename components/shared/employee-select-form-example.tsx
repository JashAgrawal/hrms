"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { EmployeeSelect } from "./employee-select"
import { useEmployees } from "@/hooks/use-employees"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// Form schemas
const leaveRequestSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  assignedTo: z.string().min(1, "Please select an employee"),
  approvers: z.array(z.string()).min(1, "At least one approver is required"),
})

const meetingSchema = z.object({
  title: z.string().min(1, "Meeting title is required"),
  description: z.string().optional(),
  organizer: z.string().min(1, "Please select an organizer"),
  attendees: z.array(z.string()).min(1, "At least one attendee is required"),
})

type LeaveRequestForm = z.infer<typeof leaveRequestSchema>
type MeetingForm = z.infer<typeof meetingSchema>

export function EmployeeSelectFormExample() {
  const { employees, loading } = useEmployees()

  // Leave Request Form
  const leaveForm = useForm<LeaveRequestForm>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      title: "",
      description: "",
      assignedTo: "",
      approvers: [],
    },
  })

  // Meeting Form
  const meetingForm = useForm<MeetingForm>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      title: "",
      description: "",
      organizer: "",
      attendees: [],
    },
  })

  const onLeaveSubmit = (data: LeaveRequestForm) => {
    console.log("Leave Request:", data)
    // Handle form submission
  }

  const onMeetingSubmit = (data: MeetingForm) => {
    console.log("Meeting:", data)
    // Handle form submission
  }

  if (loading) {
    return <div>Loading employees...</div>
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Leave Request Form */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Request Form</CardTitle>
          <CardDescription>
            Example form using single and multiple employee selection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...leaveForm}>
            <form onSubmit={leaveForm.handleSubmit(onLeaveSubmit)} className="space-y-6">
              <FormField
                control={leaveForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Request Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter request title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={leaveForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={leaveForm.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <FormControl>
                      <EmployeeSelect
                        employees={employees}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select employee to assign..."
                      />
                    </FormControl>
                    <FormDescription>
                      Select the employee this request is assigned to
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={leaveForm.control}
                name="approvers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approvers</FormLabel>
                    <FormControl>
                      <EmployeeSelect
                        employees={employees}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select approvers..."
                        multiple
                        maxDisplayed={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Select employees who can approve this request
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit">Submit Leave Request</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Meeting Form */}
      <Card>
        <CardHeader>
          <CardTitle>Meeting Scheduler</CardTitle>
          <CardDescription>
            Another example with different employee selection patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...meetingForm}>
            <form onSubmit={meetingForm.handleSubmit(onMeetingSubmit)} className="space-y-6">
              <FormField
                control={meetingForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter meeting title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={meetingForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Meeting agenda or description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={meetingForm.control}
                name="organizer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Organizer</FormLabel>
                    <FormControl>
                      <EmployeeSelect
                        employees={employees}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select meeting organizer..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={meetingForm.control}
                name="attendees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attendees</FormLabel>
                    <FormControl>
                      <EmployeeSelect
                        employees={employees}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select meeting attendees..."
                        multiple
                        maxDisplayed={5}
                      />
                    </FormControl>
                    <FormDescription>
                      Select all employees who should attend this meeting
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit">Schedule Meeting</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
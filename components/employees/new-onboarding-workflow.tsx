'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, Save, Users, FileText, Calendar, User } from 'lucide-react'

const workflowSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  templateId: z.string().min(1, 'Template is required'),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional()
})

type WorkflowFormData = z.infer<typeof workflowSchema>

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  designation: string
  joiningDate: Date
  department: {
    name: string
  }
}

interface Template {
  id: string
  name: string
  description?: string | null
  _count: {
    tasks: number
  }
}

interface HRUser {
  id: string
  name?: string | null
  email: string
}

interface NewOnboardingWorkflowProps {
  employees: Employee[]
  templates: Template[]
  hrUsers: HRUser[]
}

export function NewOnboardingWorkflow({ 
  employees, 
  templates, 
  hrUsers 
}: NewOnboardingWorkflowProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  const { control, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      employeeId: '',
      templateId: '',
      assignedTo: '',
      dueDate: '',
      notes: ''
    }
  })

  const watchedEmployeeId = watch('employeeId')
  const watchedTemplateId = watch('templateId')

  // Update selected employee when form value changes
  React.useEffect(() => {
    const employee = employees.find(e => e.id === watchedEmployeeId)
    setSelectedEmployee(employee || null)
  }, [watchedEmployeeId, employees])

  // Update selected template when form value changes
  React.useEffect(() => {
    const template = templates.find(t => t.id === watchedTemplateId)
    setSelectedTemplate(template || null)
  }, [watchedTemplateId, templates])

  const onSubmit = async (data: WorkflowFormData) => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/onboarding/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create workflow')
      }

      toast.success('Onboarding workflow created successfully', {
        description: `Workflow started for ${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`,
      })

      router.push(`/dashboard/employees/onboarding/${result.workflow.id}`)
    } catch (error) {
      console.error('Error creating workflow:', error)
      toast.error('Failed to create workflow', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const calculateDueDate = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toISOString().split('T')[0]
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Employee Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Employee
          </CardTitle>
          <CardDescription>
            Choose the employee for whom you want to start the onboarding process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employeeId">Employee *</Label>
            <Controller
              name="employeeId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <span className="font-medium">
                              {employee.firstName} {employee.lastName}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              ({employee.employeeCode})
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.employeeId && (
              <p className="text-sm font-medium text-destructive">
                {errors.employeeId.message}
              </p>
            )}
          </div>

          {selectedEmployee && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Employee Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p>{selectedEmployee.firstName} {selectedEmployee.lastName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Employee Code</Label>
                  <p>{selectedEmployee.employeeCode}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Designation</Label>
                  <p>{selectedEmployee.designation}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p>{selectedEmployee.department.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Joining Date</Label>
                  <p>{new Date(selectedEmployee.joiningDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Template
          </CardTitle>
          <CardDescription>
            Choose the onboarding template that defines the workflow tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="templateId">Onboarding Template *</Label>
            <Controller
              name="templateId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{template.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {template._count.tasks} tasks
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.templateId && (
              <p className="text-sm font-medium text-destructive">
                {errors.templateId.message}
              </p>
            )}
          </div>

          {selectedTemplate && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Template Details</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p>{selectedTemplate.name}</p>
                </div>
                {selectedTemplate.description && (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p>{selectedTemplate.description}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Total Tasks</Label>
                  <p>{selectedTemplate._count.tasks} tasks</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Workflow Configuration
          </CardTitle>
          <CardDescription>
            Configure the workflow settings and assignment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assign to HR</Label>
              <Controller
                name="assignedTo"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select HR person (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {hrUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Controller
                name="dueDate"
                control={control}
                render={({ field }) => (
                  <Input
                    id="dueDate"
                    type="date"
                    {...field}
                    min={new Date().toISOString().split('T')[0]}
                  />
                )}
              />
              <div className="flex gap-2 text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const date = calculateDueDate(7)
                    setValue('dueDate', date)
                  }}
                >
                  +7 days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const date = calculateDueDate(14)
                    setValue('dueDate', date)
                  }}
                >
                  +14 days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const date = calculateDueDate(30)
                    setValue('dueDate', date)
                  }}
                >
                  +30 days
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes or instructions..."
                  rows={3}
                  {...field}
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Start Onboarding
        </Button>
      </div>
    </form>
  )
}
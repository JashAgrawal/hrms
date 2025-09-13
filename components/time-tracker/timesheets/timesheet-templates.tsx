'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Clock, 
  Calendar,
  Repeat,
  Save,
  X
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Validation schemas
const TemplateEntrySchema = z.object({
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  breakDuration: z.number().min(0).max(480),
  projectId: z.string().optional(),
  taskDescription: z.string().optional(),
  billableHours: z.number().min(0).max(24),
  nonBillableHours: z.number().min(0).max(24),
  overtimeHours: z.number().min(0).max(24),
  dayOfWeek: z.number().min(0).max(6) // 0 = Sunday, 6 = Saturday
})

const TemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  isDefault: z.boolean(),
  entries: z.array(TemplateEntrySchema)
})

type TemplateFormData = z.infer<typeof TemplateSchema>

interface TimesheetTemplate {
  id: string
  name: string
  description?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  entries: Array<{
    id: string
    startTime: string
    endTime: string
    breakDuration: number
    projectId?: string
    taskDescription?: string
    billableHours: number
    nonBillableHours: number
    overtimeHours: number
    dayOfWeek: number
    project?: {
      id: string
      name: string
      code: string
    }
  }>
}

interface Project {
  id: string
  name: string
  code: string
  status: string
}

interface TimesheetTemplatesProps {
  projects: Project[]
  onApplyTemplate: (template: TimesheetTemplate) => void
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]

export function TimesheetTemplates({ projects, onApplyTemplate }: TimesheetTemplatesProps) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<TimesheetTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TimesheetTemplate | null>(null)

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(TemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      isDefault: false,
      entries: []
    }
  })

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/timesheets/templates')
      if (!res.ok) throw new Error('Failed to fetch templates')
      
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  // Handle template creation/editing
  const handleSaveTemplate = async (data: TemplateFormData) => {
    try {
      const url = editingTemplate 
        ? `/api/timesheets/templates/${editingTemplate.id}`
        : '/api/timesheets/templates'
      const method = editingTemplate ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save template')
      }

      toast({
        title: 'Success',
        description: `Template ${editingTemplate ? 'updated' : 'created'} successfully`
      })

      setShowCreateModal(false)
      setEditingTemplate(null)
      form.reset()
      fetchTemplates()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  // Handle template deletion
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const res = await fetch(`/api/timesheets/templates/${templateId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete template')
      }

      toast({
        title: 'Success',
        description: 'Template deleted successfully'
      })

      fetchTemplates()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  // Handle template duplication
  const handleDuplicateTemplate = (template: TimesheetTemplate) => {
    form.reset({
      name: `${template.name} (Copy)`,
      description: template.description,
      isDefault: false,
      entries: template.entries.map(entry => ({
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakDuration: entry.breakDuration,
        projectId: entry.projectId,
        taskDescription: entry.taskDescription,
        billableHours: entry.billableHours,
        nonBillableHours: entry.nonBillableHours,
        overtimeHours: entry.overtimeHours,
        dayOfWeek: entry.dayOfWeek
      }))
    })
    setShowCreateModal(true)
  }

  // Handle edit template
  const handleEditTemplate = (template: TimesheetTemplate) => {
    setEditingTemplate(template)
    form.reset({
      name: template.name,
      description: template.description,
      isDefault: template.isDefault,
      entries: template.entries.map(entry => ({
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakDuration: entry.breakDuration,
        projectId: entry.projectId,
        taskDescription: entry.taskDescription,
        billableHours: entry.billableHours,
        nonBillableHours: entry.nonBillableHours,
        overtimeHours: entry.overtimeHours,
        dayOfWeek: entry.dayOfWeek
      }))
    })
    setShowCreateModal(true)
  }

  // Add new entry to template
  const addEntry = () => {
    const currentEntries = form.getValues('entries')
    form.setValue('entries', [
      ...currentEntries,
      {
        startTime: '09:00',
        endTime: '17:00',
        breakDuration: 60,
        projectId: '',
        taskDescription: '',
        billableHours: 8,
        nonBillableHours: 0,
        overtimeHours: 0,
        dayOfWeek: 1 // Monday
      }
    ])
  }

  // Remove entry from template
  const removeEntry = (index: number) => {
    const currentEntries = form.getValues('entries')
    form.setValue('entries', currentEntries.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Timesheet Templates</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage reusable timesheet templates
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {template.name}
                    {template.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </CardTitle>
                  {template.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{template.entries.length} entries</span>
                </div>
                
                {/* Show unique days */}
                <div className="flex flex-wrap gap-1">
                  {Array.from(new Set(template.entries.map(e => e.dayOfWeek)))
                    .sort()
                    .map(day => (
                      <Badge key={day} variant="outline" className="text-xs">
                        {DAYS_OF_WEEK[day].slice(0, 3)}
                      </Badge>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => onApplyTemplate(template)}
                    className="flex-1"
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditTemplate(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDuplicateTemplate(template)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {templates.length === 0 && (
          <div className="col-span-full text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No templates created yet</p>
            <Button 
              variant="outline" 
              className="mt-2"
              onClick={() => setShowCreateModal(true)}
            >
              Create your first template
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Template Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveTemplate)} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Standard Work Week" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Set as default template</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe when to use this template..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Template Entries */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Template Entries</h4>
                  <Button type="button" variant="outline" onClick={addEntry}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </div>

                {form.watch('entries').length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No entries added yet</p>
                    <Button type="button" variant="outline" className="mt-2" onClick={addEntry}>
                      Add your first entry
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {form.watch('entries').map((entry, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div>
                              <label className="text-sm font-medium">Day</label>
                              <Select
                                value={entry.dayOfWeek.toString()}
                                onValueChange={(value) => {
                                  const entries = form.getValues('entries')
                                  entries[index].dayOfWeek = parseInt(value)
                                  form.setValue('entries', entries)
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DAYS_OF_WEEK.map((day, dayIndex) => (
                                    <SelectItem key={dayIndex} value={dayIndex.toString()}>
                                      {day}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <label className="text-sm font-medium">Start</label>
                              <Input
                                type="time"
                                value={entry.startTime}
                                onChange={(e) => {
                                  const entries = form.getValues('entries')
                                  entries[index].startTime = e.target.value
                                  form.setValue('entries', entries)
                                }}
                              />
                            </div>

                            <div>
                              <label className="text-sm font-medium">End</label>
                              <Input
                                type="time"
                                value={entry.endTime}
                                onChange={(e) => {
                                  const entries = form.getValues('entries')
                                  entries[index].endTime = e.target.value
                                  form.setValue('entries', entries)
                                }}
                              />
                            </div>

                            <div>
                              <label className="text-sm font-medium">Break (min)</label>
                              <Input
                                type="number"
                                min="0"
                                max="480"
                                value={entry.breakDuration}
                                onChange={(e) => {
                                  const entries = form.getValues('entries')
                                  entries[index].breakDuration = parseInt(e.target.value) || 0
                                  form.setValue('entries', entries)
                                }}
                              />
                            </div>

                            <div>
                              <label className="text-sm font-medium">Project</label>
                              <Select
                                value={entry.projectId || ''}
                                onValueChange={(value) => {
                                  const entries = form.getValues('entries')
                                  entries[index].projectId = value || undefined
                                  form.setValue('entries', entries)
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select project" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">No project</SelectItem>
                                  {projects.map((project) => (
                                    <SelectItem key={project.id} value={project.id}>
                                      {project.code} - {project.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeEntry(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="text-sm font-medium">Task Description</label>
                            <Textarea
                              placeholder="Describe the work to be done..."
                              value={entry.taskDescription || ''}
                              onChange={(e) => {
                                const entries = form.getValues('entries')
                                entries[index].taskDescription = e.target.value
                                form.setValue('entries', entries)
                              }}
                              rows={2}
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-4 mt-4">
                            <div>
                              <label className="text-sm font-medium">Billable Hours</label>
                              <Input
                                type="number"
                                step="0.25"
                                min="0"
                                max="24"
                                value={entry.billableHours}
                                onChange={(e) => {
                                  const entries = form.getValues('entries')
                                  entries[index].billableHours = parseFloat(e.target.value) || 0
                                  form.setValue('entries', entries)
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Non-billable Hours</label>
                              <Input
                                type="number"
                                step="0.25"
                                min="0"
                                max="24"
                                value={entry.nonBillableHours}
                                onChange={(e) => {
                                  const entries = form.getValues('entries')
                                  entries[index].nonBillableHours = parseFloat(e.target.value) || 0
                                  form.setValue('entries', entries)
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Overtime Hours</label>
                              <Input
                                type="number"
                                step="0.25"
                                min="0"
                                max="24"
                                value={entry.overtimeHours}
                                onChange={(e) => {
                                  const entries = form.getValues('entries')
                                  entries[index].overtimeHours = parseFloat(e.target.value) || 0
                                  form.setValue('entries', entries)
                                }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingTemplate(null)
                    form.reset()
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

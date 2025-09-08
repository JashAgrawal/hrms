'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  User, 
  Settings, 
  GraduationCap,
  Shield,
  Monitor,
  Users,
  GripVertical
} from 'lucide-react'

interface OnboardingTaskTemplate {
  id?: string
  title: string
  description: string
  category: string
  isRequired: boolean
  order: number
  daysToComplete?: number
  assignedRole: string
}

interface OnboardingTemplate {
  id?: string
  name: string
  description: string
  tasks: OnboardingTaskTemplate[]
}

interface OnboardingChecklistProps {
  template?: OnboardingTemplate
  onSave?: (template: OnboardingTemplate) => void
  isEditing?: boolean
}

const categories = [
  { value: 'PERSONAL_INFO', label: 'Personal Information', icon: User },
  { value: 'DOCUMENTS', label: 'Documents', icon: FileText },
  { value: 'SYSTEM_ACCESS', label: 'System Access', icon: Settings },
  { value: 'TRAINING', label: 'Training', icon: GraduationCap },
  { value: 'COMPLIANCE', label: 'Compliance', icon: Shield },
  { value: 'EQUIPMENT', label: 'Equipment', icon: Monitor },
  { value: 'INTRODUCTION', label: 'Introduction', icon: Users },
]

const roles = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'HR', label: 'HR' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'ADMIN', label: 'Admin' },
]

const defaultTasks: OnboardingTaskTemplate[] = [
  {
    title: 'Complete Personal Information Form',
    description: 'Fill out all personal details including emergency contacts',
    category: 'PERSONAL_INFO',
    isRequired: true,
    order: 1,
    daysToComplete: 1,
    assignedRole: 'EMPLOYEE'
  },
  {
    title: 'Upload Profile Photo',
    description: 'Upload a professional profile photo for ID card',
    category: 'PERSONAL_INFO',
    isRequired: true,
    order: 2,
    daysToComplete: 2,
    assignedRole: 'EMPLOYEE'
  },
  {
    title: 'Submit Identity Documents',
    description: 'Upload PAN card, Aadhar card, and passport size photos',
    category: 'DOCUMENTS',
    isRequired: true,
    order: 3,
    daysToComplete: 3,
    assignedRole: 'EMPLOYEE'
  },
  {
    title: 'Bank Account Details',
    description: 'Provide bank account details for salary processing',
    category: 'DOCUMENTS',
    isRequired: true,
    order: 4,
    daysToComplete: 3,
    assignedRole: 'EMPLOYEE'
  },
  {
    title: 'Educational Certificates',
    description: 'Upload degree certificates and mark sheets',
    category: 'DOCUMENTS',
    isRequired: true,
    order: 5,
    daysToComplete: 5,
    assignedRole: 'EMPLOYEE'
  },
  {
    title: 'Create System Accounts',
    description: 'Set up email, HRMS, and other system accounts',
    category: 'SYSTEM_ACCESS',
    isRequired: true,
    order: 6,
    daysToComplete: 1,
    assignedRole: 'HR'
  },
  {
    title: 'IT Equipment Assignment',
    description: 'Assign laptop, mobile, and other IT equipment',
    category: 'EQUIPMENT',
    isRequired: true,
    order: 7,
    daysToComplete: 2,
    assignedRole: 'HR'
  },
  {
    title: 'Office Tour and Introduction',
    description: 'Introduce to team members and show office facilities',
    category: 'INTRODUCTION',
    isRequired: true,
    order: 8,
    daysToComplete: 1,
    assignedRole: 'MANAGER'
  },
  {
    title: 'Company Policies Training',
    description: 'Complete mandatory training on company policies',
    category: 'TRAINING',
    isRequired: true,
    order: 9,
    daysToComplete: 7,
    assignedRole: 'EMPLOYEE'
  },
  {
    title: 'Security and Compliance Training',
    description: 'Complete security awareness and compliance training',
    category: 'COMPLIANCE',
    isRequired: true,
    order: 10,
    daysToComplete: 7,
    assignedRole: 'EMPLOYEE'
  }
]

export function OnboardingChecklist({ template, onSave, isEditing = false }: OnboardingChecklistProps) {
  const [templateData, setTemplateData] = useState<OnboardingTemplate>({
    name: template?.name || 'Default Onboarding Template',
    description: template?.description || 'Standard onboarding process for new employees',
    tasks: template?.tasks || defaultTasks,
    ...template
  })
  const [isLoading, setIsLoading] = useState(false)

  const addTask = () => {
    const newTask: OnboardingTaskTemplate = {
      title: '',
      description: '',
      category: 'PERSONAL_INFO',
      isRequired: true,
      order: templateData.tasks.length + 1,
      daysToComplete: 1,
      assignedRole: 'EMPLOYEE'
    }
    setTemplateData(prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask]
    }))
  }

  const updateTask = (index: number, field: keyof OnboardingTaskTemplate, value: any) => {
    setTemplateData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => 
        i === index ? { ...task, [field]: value } : task
      )
    }))
  }

  const removeTask = (index: number) => {
    setTemplateData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }))
  }

  const moveTask = (index: number, direction: 'up' | 'down') => {
    const newTasks = [...templateData.tasks]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex >= 0 && targetIndex < newTasks.length) {
      [newTasks[index], newTasks[targetIndex]] = [newTasks[targetIndex], newTasks[index]]
      
      // Update order numbers
      newTasks.forEach((task, i) => {
        task.order = i + 1
      })
      
      setTemplateData(prev => ({ ...prev, tasks: newTasks }))
    }
  }

  const handleSave = async () => {
    if (!templateData.name.trim()) {
      toast.error('Template name is required')
      return
    }

    if (templateData.tasks.length === 0) {
      toast.error('At least one task is required')
      return
    }

    const invalidTasks = templateData.tasks.filter(task => !task.title.trim())
    if (invalidTasks.length > 0) {
      toast.error('All tasks must have a title')
      return
    }

    setIsLoading(true)
    try {
      const url = isEditing ? `/api/onboarding/templates/${template?.id}` : '/api/onboarding/templates'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      })

      if (!response.ok) {
        throw new Error('Failed to save template')
      }

      const result = await response.json()
      toast.success(
        isEditing ? 'Template updated successfully' : 'Template created successfully'
      )
      
      onSave?.(result.template)
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Failed to save template')
    } finally {
      setIsLoading(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    const categoryData = categories.find(c => c.value === category)
    const Icon = categoryData?.icon || FileText
    return <Icon className="h-4 w-4" />
  }

  return (
    <div className="space-y-6">
      {/* Template Header */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Template</CardTitle>
          <CardDescription>
            Configure the onboarding checklist and workflow for new employees
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={templateData.name}
                onChange={(e) => setTemplateData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter template name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateDescription">Description</Label>
              <Input
                id="templateDescription"
                value={templateData.description}
                onChange={(e) => setTemplateData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter template description"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Onboarding Tasks</CardTitle>
              <CardDescription>
                Define the tasks that need to be completed during onboarding
              </CardDescription>
            </div>
            <Button onClick={addTask} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {templateData.tasks.map((task, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveTask(index, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveTask(index, 'down')}
                          disabled={index === templateData.tasks.length - 1}
                        >
                          ↓
                        </Button>
                      </div>
                      <Badge variant="outline">#{task.order}</Badge>
                      {getCategoryIcon(task.category)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTask(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Task Title</Label>
                      <Input
                        value={task.title}
                        onChange={(e) => updateTask(index, 'title', e.target.value)}
                        placeholder="Enter task title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={task.category}
                        onValueChange={(value) => updateTask(index, 'category', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              <div className="flex items-center gap-2">
                                <category.icon className="h-4 w-4" />
                                {category.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={task.description}
                      onChange={(e) => updateTask(index, 'description', e.target.value)}
                      placeholder="Enter task description"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Assigned To</Label>
                      <Select
                        value={task.assignedRole}
                        onValueChange={(value) => updateTask(index, 'assignedRole', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Days to Complete</Label>
                      <Input
                        type="number"
                        value={task.daysToComplete || ''}
                        onChange={(e) => updateTask(index, 'daysToComplete', parseInt(e.target.value) || undefined)}
                        placeholder="Days"
                        min="1"
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox
                        id={`required-${index}`}
                        checked={task.isRequired}
                        onCheckedChange={(checked) => updateTask(index, 'isRequired', checked)}
                      />
                      <Label htmlFor={`required-${index}`}>Required</Label>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {templateData.tasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tasks added yet. Click "Add Task" to get started.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? (
            <>Loading...</>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Update Template' : 'Save Template'}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Search, Plus, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { ProjectWithCount, ProjectStatus } from '@/components/time-tracker/shared/prisma-types'
import { Project } from '@prisma/client'

interface ProjectSelectProps {
  value?: string
  onValueChange: (value: string) => void
  projects: ProjectWithCount[]
  onRefresh?: () => void
  placeholder?: string
  disabled?: boolean
  allowCreate?: boolean
  onCreateProject?: (project: Omit<ProjectWithCount, 'id' | '_count'>) => Promise<ProjectWithCount>
  className?: string
}

export function ProjectSelect({
  value,
  onValueChange,
  projects,
  onRefresh,
  placeholder = "Select project...",
  disabled = false,
  allowCreate = false,
  onCreateProject,
  className
}: ProjectSelectProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Filter projects based on search
  const filteredProjects = projects.filter(project => {
    const searchTerm = searchValue.toLowerCase()
    return (
      project.name.toLowerCase().includes(searchTerm) ||
      project.code.toLowerCase().includes(searchTerm) ||
      project.clientName?.toLowerCase().includes(searchTerm)
    )
  })

  // Group projects by status
  const activeProjects = filteredProjects.filter(p => p.status === 'ACTIVE')
  const completedProjects = filteredProjects.filter(p => p.status === 'COMPLETED')
  const otherProjects = filteredProjects.filter(p => !['ACTIVE', 'COMPLETED'].includes(p.status))

  const selectedProject = projects.find(p => p.id === value)

  // Create new project
  const handleCreateProject = async (projectData: Omit<Project, 'id'>) => {
    if (!onCreateProject) return

    try {
      setIsCreating(true)
      const newProject = await onCreateProject(projectData)
      onValueChange(newProject.id)
      setShowCreateDialog(false)
      onRefresh?.()
      toast({
        title: 'Success',
        description: 'Project created successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create project',
        variant: 'destructive'
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("justify-between", className)}
            disabled={disabled}
          >
            {selectedProject ? (
              <div className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{selectedProject.name}</span>
                <Badge variant="outline" className="text-xs">
                  {selectedProject.code}
                </Badge>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Search projects..."
                value={searchValue}
                onValueChange={setSearchValue}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <CommandList className="max-h-[300px]">
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 py-6">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No projects found</p>
                  {allowCreate && onCreateProject && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Project
                    </Button>
                  )}
                </div>
              </CommandEmpty>

              {/* Clear selection option */}
              {value && (
                <CommandGroup>
                  <CommandItem
                    value=""
                    onSelect={() => {
                      onValueChange('')
                      setOpen(false)
                    }}
                    className="text-muted-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4" />
                      No Project
                    </div>
                  </CommandItem>
                </CommandGroup>
              )}

              {/* Active Projects */}
              {activeProjects.length > 0 && (
                <CommandGroup heading="Active Projects">
                  {activeProjects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={project.id}
                      onSelect={(currentValue) => {
                        onValueChange(currentValue === value ? '' : currentValue)
                        setOpen(false)
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4",
                              value === project.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{project.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {project.code}
                              </Badge>
                            </div>
                            {project.clientName && (
                              <span className="text-xs text-muted-foreground">
                                {project.clientName}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="default" className="text-xs">
                          {project.status}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Completed Projects */}
              {completedProjects.length > 0 && (
                <>
                  {activeProjects.length > 0 && <Separator />}
                  <CommandGroup heading="Completed Projects">
                    {completedProjects.map((project) => (
                      <CommandItem
                        key={project.id}
                        value={project.id}
                        onSelect={(currentValue) => {
                          onValueChange(currentValue === value ? '' : currentValue)
                          setOpen(false)
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <Check
                              className={cn(
                                "h-4 w-4",
                                value === project.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-muted-foreground">
                                  {project.name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {project.code}
                                </Badge>
                              </div>
                              {project.clientName && (
                                <span className="text-xs text-muted-foreground">
                                  {project.clientName}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {project.status}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Other Projects */}
              {otherProjects.length > 0 && (
                <>
                  {(activeProjects.length > 0 || completedProjects.length > 0) && <Separator />}
                  <CommandGroup heading="Other Projects">
                    {otherProjects.map((project) => (
                      <CommandItem
                        key={project.id}
                        value={project.id}
                        onSelect={(currentValue) => {
                          onValueChange(currentValue === value ? '' : currentValue)
                          setOpen(false)
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <Check
                              className={cn(
                                "h-4 w-4",
                                value === project.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{project.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {project.code}
                                </Badge>
                              </div>
                              {project.clientName && (
                                <span className="text-xs text-muted-foreground">
                                  {project.clientName}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge 
                            variant={project.status === 'ON_HOLD' ? 'secondary' : 'destructive'} 
                            className="text-xs"
                          >
                            {project.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Create new project option */}
              {allowCreate && onCreateProject && filteredProjects.length > 0 && (
                <>
                  <Separator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => setShowCreateDialog(true)}
                      className="text-primary"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Project
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Project Dialog */}
      {allowCreate && onCreateProject && (
        <CreateProjectDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreateProject={handleCreateProject}
          isLoading={isCreating}
        />
      )}
    </>
  )
}

// Create Project Dialog Component
interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateProject: (project: Omit<ProjectWithCount, 'id' | '_count'>) => void
  isLoading: boolean
}

function CreateProjectDialog({
  open,
  onOpenChange,
  onCreateProject,
  isLoading
}: CreateProjectDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    clientName: '',
    status: 'ACTIVE' as ProjectStatus,
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreateProject({
      ...formData,
      startDate: new Date(formData.startDate),
      endDate: formData.endDate ? new Date(formData.endDate) : null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  const handleReset = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      clientName: '',
      status: 'ACTIVE' as ProjectStatus,
      startDate: new Date().toISOString().split('T')[0],
      endDate: ''
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter project name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Project Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="e.g., PROJ001"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name</Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
              placeholder="Enter client name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter project description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                min={formData.startDate}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: ProjectStatus) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleReset()
                onOpenChange(false)
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

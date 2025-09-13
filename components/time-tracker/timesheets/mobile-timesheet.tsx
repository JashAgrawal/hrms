'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  Calendar,
  Plus,
  Edit,
  Save,
  X,
  Timer,
  MapPin,
  Smartphone
} from 'lucide-react'
import { format, differenceInMinutes, parseISO } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

interface Project {
  id: string
  name: string
  code: string
  status: string
}

interface TimeEntry {
  id?: string
  date: string
  startTime?: string
  endTime?: string
  breakDuration: number
  projectId?: string
  taskDescription?: string
  billableHours: number
  nonBillableHours: number
  overtimeHours: number
  isRunning?: boolean
  location?: {
    latitude: number
    longitude: number
    address?: string
  }
}

interface MobileTimesheetProps {
  projects: Project[]
  onSaveEntry: (entry: TimeEntry) => Promise<void>
  onUpdateEntry: (id: string, entry: Partial<TimeEntry>) => Promise<void>
  onDeleteEntry: (id: string) => Promise<void>
  initialEntries?: TimeEntry[]
}

export function MobileTimesheet({
  projects,
  onSaveEntry,
  onUpdateEntry,
  onDeleteEntry,
  initialEntries = []
}: MobileTimesheetProps) {
  const { toast } = useToast()
  
  // State management
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries)
  const [activeTimer, setActiveTimer] = useState<string | null>(null)
  const [timerStart, setTimerStart] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showQuickEntry, setShowQuickEntry] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [location, setLocation] = useState<GeolocationPosition | null>(null)
  const [locationEnabled, setLocationEnabled] = useState(false)

  // Quick entry form state
  const [quickEntry, setQuickEntry] = useState<Partial<TimeEntry>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    projectId: '',
    taskDescription: '',
    breakDuration: 0,
    billableHours: 0,
    nonBillableHours: 0,
    overtimeHours: 0
  })

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (activeTimer && timerStart) {
      interval = setInterval(() => {
        setElapsedTime(differenceInMinutes(new Date(), timerStart))
      }, 1000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [activeTimer, timerStart])

  // Location tracking
  useEffect(() => {
    if (locationEnabled && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(position)
        },
        (error) => {
          console.error('Location error:', error)
          toast({
            title: 'Location Error',
            description: 'Unable to get your location',
            variant: 'destructive'
          })
        }
      )
    }
  }, [locationEnabled])

  // Start timer
  const startTimer = async (projectId?: string, taskDescription?: string) => {
    try {
      const now = new Date()
      const entryId = `temp-${Date.now()}`
      
      const newEntry: TimeEntry = {
        id: entryId,
        date: format(now, 'yyyy-MM-dd'),
        startTime: format(now, 'HH:mm'),
        projectId,
        taskDescription,
        breakDuration: 0,
        billableHours: 0,
        nonBillableHours: 0,
        overtimeHours: 0,
        isRunning: true,
        ...(location && {
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          }
        })
      }

      setEntries(prev => [...prev, newEntry])
      setActiveTimer(entryId)
      setTimerStart(now)
      setElapsedTime(0)

      toast({
        title: 'Timer Started',
        description: 'Time tracking has begun'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start timer',
        variant: 'destructive'
      })
    }
  }

  // Stop timer
  const stopTimer = async () => {
    if (!activeTimer || !timerStart) return

    try {
      const now = new Date()
      const entry = entries.find(e => e.id === activeTimer)
      
      if (entry) {
        const totalMinutes = differenceInMinutes(now, timerStart)
        const hours = totalMinutes / 60
        
        const updatedEntry: TimeEntry = {
          ...entry,
          endTime: format(now, 'HH:mm'),
          billableHours: Math.round(hours * 4) / 4, // Round to nearest 15 minutes
          isRunning: false
        }

        // Save to backend
        await onSaveEntry(updatedEntry)
        
        // Update local state
        setEntries(prev => prev.map(e => 
          e.id === activeTimer ? updatedEntry : e
        ))
      }

      setActiveTimer(null)
      setTimerStart(null)
      setElapsedTime(0)

      toast({
        title: 'Timer Stopped',
        description: `Logged ${Math.round(elapsedTime / 60 * 4) / 4} hours`
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to stop timer',
        variant: 'destructive'
      })
    }
  }

  // Pause timer
  const pauseTimer = () => {
    if (activeTimer) {
      setActiveTimer(null)
      setTimerStart(null)
      
      toast({
        title: 'Timer Paused',
        description: 'You can resume or stop the timer'
      })
    }
  }

  // Resume timer
  const resumeTimer = (entryId: string) => {
    const entry = entries.find(e => e.id === entryId)
    if (entry && entry.isRunning) {
      setActiveTimer(entryId)
      setTimerStart(new Date())
      
      toast({
        title: 'Timer Resumed',
        description: 'Time tracking continued'
      })
    }
  }

  // Quick entry save
  const saveQuickEntry = async () => {
    try {
      if (!quickEntry.projectId || !quickEntry.taskDescription) {
        toast({
          title: 'Missing Information',
          description: 'Please select a project and add a description',
          variant: 'destructive'
        })
        return
      }

      const entry: TimeEntry = {
        date: quickEntry.date || format(new Date(), 'yyyy-MM-dd'),
        projectId: quickEntry.projectId,
        taskDescription: quickEntry.taskDescription,
        breakDuration: quickEntry.breakDuration || 0,
        billableHours: quickEntry.billableHours || 0,
        nonBillableHours: quickEntry.nonBillableHours || 0,
        overtimeHours: quickEntry.overtimeHours || 0,
        startTime: quickEntry.startTime,
        endTime: quickEntry.endTime
      }

      await onSaveEntry(entry)
      
      setEntries(prev => [...prev, { ...entry, id: `entry-${Date.now()}` }])
      setShowQuickEntry(false)
      setQuickEntry({
        date: format(new Date(), 'yyyy-MM-dd'),
        projectId: '',
        taskDescription: '',
        breakDuration: 0,
        billableHours: 0,
        nonBillableHours: 0,
        overtimeHours: 0
      })

      toast({
        title: 'Entry Saved',
        description: 'Time entry has been recorded'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save entry',
        variant: 'destructive'
      })
    }
  }

  // Format elapsed time
  const formatElapsedTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  // Get project name
  const getProjectName = (projectId?: string) => {
    const project = projects.find(p => p.id === projectId)
    return project ? `${project.code} - ${project.name}` : 'No project'
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Mobile Timesheet</h2>
          <p className="text-sm text-muted-foreground">
            Track time on the go
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocationEnabled(!locationEnabled)}
          >
            <MapPin className={`h-4 w-4 ${locationEnabled ? 'text-green-600' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setShowQuickEntry(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Quick Entry
          </Button>
        </div>
      </div>

      {/* Active Timer */}
      {activeTimer && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <div>
                  <p className="font-medium">Timer Running</p>
                  <p className="text-sm text-muted-foreground">
                    {getProjectName(entries.find(e => e.id === activeTimer)?.projectId)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-mono font-bold text-green-600">
                  {formatElapsedTime(elapsedTime)}
                </p>
                <div className="flex gap-1 mt-2">
                  <Button size="sm" variant="outline" onClick={pauseTimer}>
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={stopTimer}>
                    <Square className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Start Buttons */}
      {!activeTimer && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-16 flex-col"
            onClick={() => startTimer()}
          >
            <Play className="h-6 w-6 mb-1" />
            <span className="text-sm">Start Timer</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex-col"
            onClick={() => setShowQuickEntry(true)}
          >
            <Clock className="h-6 w-6 mb-1" />
            <span className="text-sm">Manual Entry</span>
          </Button>
        </div>
      )}

      {/* Recent Entries */}
      <div className="space-y-3">
        <h3 className="font-medium">Today's Entries</h3>
        {entries
          .filter(entry => entry.date === format(new Date(), 'yyyy-MM-dd'))
          .map((entry, index) => (
            <Card key={entry.id || index}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {getProjectName(entry.projectId)}
                      </Badge>
                      {entry.isRunning && (
                        <Badge variant="secondary" className="text-xs">
                          Running
                        </Badge>
                      )}
                      {entry.location && (
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm font-medium mb-1">
                      {entry.taskDescription || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {entry.startTime && entry.endTime ? (
                        <span>{entry.startTime} - {entry.endTime}</span>
                      ) : entry.startTime ? (
                        <span>Started at {entry.startTime}</span>
                      ) : null}
                      <span>
                        {(entry.billableHours + entry.nonBillableHours + entry.overtimeHours).toFixed(2)}h
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {entry.isRunning && !activeTimer && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resumeTimer(entry.id!)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingEntry(entry)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Quick Entry Modal */}
      <Dialog open={showQuickEntry} onOpenChange={setShowQuickEntry}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Time Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={quickEntry.date}
                onChange={(e) => setQuickEntry(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Project</label>
              <Select
                value={quickEntry.projectId}
                onValueChange={(value) => setQuickEntry(prev => ({ ...prev, projectId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.code} - {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="What did you work on?"
                value={quickEntry.taskDescription}
                onChange={(e) => setQuickEntry(prev => ({ ...prev, taskDescription: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <Input
                  type="time"
                  value={quickEntry.startTime}
                  onChange={(e) => setQuickEntry(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Time</label>
                <Input
                  type="time"
                  value={quickEntry.endTime}
                  onChange={(e) => setQuickEntry(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Hours</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Input
                    type="number"
                    step="0.25"
                    placeholder="Billable"
                    value={quickEntry.billableHours}
                    onChange={(e) => setQuickEntry(prev => ({ 
                      ...prev, 
                      billableHours: parseFloat(e.target.value) || 0 
                    }))}
                  />
                  <label className="text-xs text-muted-foreground">Billable</label>
                </div>
                <div>
                  <Input
                    type="number"
                    step="0.25"
                    placeholder="Non-bill"
                    value={quickEntry.nonBillableHours}
                    onChange={(e) => setQuickEntry(prev => ({ 
                      ...prev, 
                      nonBillableHours: parseFloat(e.target.value) || 0 
                    }))}
                  />
                  <label className="text-xs text-muted-foreground">Non-bill</label>
                </div>
                <div>
                  <Input
                    type="number"
                    step="0.25"
                    placeholder="Overtime"
                    value={quickEntry.overtimeHours}
                    onChange={(e) => setQuickEntry(prev => ({ 
                      ...prev, 
                      overtimeHours: parseFloat(e.target.value) || 0 
                    }))}
                  />
                  <label className="text-xs text-muted-foreground">Overtime</label>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowQuickEntry(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={saveQuickEntry}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Modal */}
      {editingEntry && (
        <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Time Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Project</label>
                <Select
                  value={editingEntry.projectId}
                  onValueChange={(value) => setEditingEntry(prev => prev ? ({ ...prev, projectId: value }) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} - {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editingEntry.taskDescription}
                  onChange={(e) => setEditingEntry(prev => prev ? ({ ...prev, taskDescription: e.target.value }) : null)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Start</label>
                  <Input
                    type="time"
                    value={editingEntry.startTime}
                    onChange={(e) => setEditingEntry(prev => prev ? ({ ...prev, startTime: e.target.value }) : null)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End</label>
                  <Input
                    type="time"
                    value={editingEntry.endTime}
                    onChange={(e) => setEditingEntry(prev => prev ? ({ ...prev, endTime: e.target.value }) : null)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingEntry(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={async () => {
                    if (editingEntry.id) {
                      await onUpdateEntry(editingEntry.id, editingEntry)
                      setEntries(prev => prev.map(e => 
                        e.id === editingEntry.id ? editingEntry : e
                      ))
                    }
                    setEditingEntry(null)
                  }}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Update
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

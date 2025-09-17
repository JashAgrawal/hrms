'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Calendar,
  Eye
} from 'lucide-react'
import { EditHolidayDialog } from './edit-holiday-dialog'

interface Holiday {
  id: string
  name: string
  date: string
  type: 'PUBLIC' | 'COMPANY' | 'OPTIONAL' | 'RELIGIOUS' | 'NATIONAL'
  description?: string
  isOptional: boolean
  isActive: boolean
  year: number
}

interface HolidayListProps {
  holidays: Holiday[]
  onHolidayUpdated: () => void
  canEdit: boolean
}

export function HolidayList({ holidays, onHolidayUpdated, canEdit }: HolidayListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null)
  const { toast } = useToast()

  const filteredHolidays = holidays.filter(holiday => {
    const matchesSearch = holiday.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         holiday.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === 'all' || holiday.type === typeFilter
    return matchesSearch && matchesType && holiday.isActive
  })

  const handleDeleteHoliday = async (holiday: Holiday) => {
    try {
      const response = await fetch(`/api/holidays/${holiday.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Holiday deleted successfully',
        })
        onHolidayUpdated()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete holiday')
      }
    } catch (error) {
      console.error('Error deleting holiday:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete holiday',
        variant: 'destructive',
      })
    } finally {
      setDeletingHoliday(null)
    }
  }

  const getTypeColor = (type: string) => {
    const colors = {
      PUBLIC: 'bg-blue-100 text-blue-800',
      COMPANY: 'bg-green-100 text-green-800',
      OPTIONAL: 'bg-purple-100 text-purple-800',
      RELIGIOUS: 'bg-orange-100 text-orange-800',
      NATIONAL: 'bg-red-100 text-red-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, 'MMM dd, yyyy (EEEE)')
  }

  const isUpcoming = (dateString: string) => {
    const holidayDate = new Date(dateString)
    const today = new Date()
    return holidayDate >= today
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Holiday List
          </CardTitle>
          <CardDescription>
            Manage all company holidays and festivals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search holidays..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Types</option>
              <option value="PUBLIC">Public</option>
              <option value="COMPANY">Company</option>
              <option value="OPTIONAL">Optional</option>
              <option value="RELIGIOUS">Religious</option>
              <option value="NATIONAL">National</option>
            </select>
          </div>

          {/* Holiday Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holiday Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  {canEdit && <TableHead className="w-[70px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHolidays.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={canEdit ? 6 : 5} 
                      className="text-center py-8 text-muted-foreground"
                    >
                      No holidays found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHolidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <span>{holiday.name}</span>
                          {isUpcoming(holiday.date) && (
                            <Badge variant="outline" className="text-xs">
                              Upcoming
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(holiday.date)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(holiday.type)}>
                          {holiday.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {holiday.isOptional && (
                            <Badge variant="secondary" className="text-xs">
                              Optional
                            </Badge>
                          )}
                          <Badge 
                            variant={holiday.isActive ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {holiday.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={holiday.description}>
                          {holiday.description || '—'}
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => setEditingHoliday(holiday)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletingHoliday(holiday)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredHolidays.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredHolidays.length} of {holidays.filter(h => h.isActive).length} holidays
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Holiday Dialog */}
      <EditHolidayDialog
        holiday={editingHoliday}
        open={!!editingHoliday}
        onOpenChange={(open) => !open && setEditingHoliday(null)}
        onHolidayUpdated={onHolidayUpdated}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingHoliday} onOpenChange={() => setDeletingHoliday(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingHoliday?.name}"? 
              This action cannot be undone and will remove the holiday from all calendars.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingHoliday && handleDeleteHoliday(deletingHoliday)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Users, 
  Calendar,
  Settings,
  Eye
} from 'lucide-react'
// import { CreateOptionalLeavePolicyDialog } from './create-optional-leave-policy-dialog'

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

interface OptionalLeavePolicy {
  id: string
  name: string
  description?: string
  year: number
  maxSelectableLeaves: number
  selectionDeadline?: string
  isActive: boolean
  holidays: Array<{
    holiday: Holiday
  }>
  employeeSelections: Array<{
    employee: {
      id: string
      firstName: string
      lastName: string
      employeeCode: string
    }
    holiday: {
      id: string
      name: string
      date: string
    }
  }>
  _count: {
    holidays: number
    employeeSelections: number
  }
}

interface OptionalLeavePolicyManagerProps {
  policies: OptionalLeavePolicy[]
  holidays: Holiday[]
  year: number
  onPolicyUpdated: () => void
  canEdit: boolean
}

export function OptionalLeavePolicyManager({
  policies,
  holidays,
  year,
  onPolicyUpdated,
  canEdit
}: OptionalLeavePolicyManagerProps) {
  const [createPolicyOpen, setCreatePolicyOpen] = useState(false)
  const [deletingPolicy, setDeletingPolicy] = useState<OptionalLeavePolicy | null>(null)
  const { toast } = useToast()

  const handleDeletePolicy = async (policy: OptionalLeavePolicy) => {
    try {
      const response = await fetch(`/api/optional-leave-policies/${policy.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Optional leave policy deleted successfully',
        })
        onPolicyUpdated()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete policy')
      }
    } catch (error) {
      console.error('Error deleting policy:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete policy',
        variant: 'destructive',
      })
    } finally {
      setDeletingPolicy(null)
    }
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy')
  }

  const isDeadlinePassed = (deadline?: string) => {
    if (!deadline) return false
    return new Date() > new Date(deadline)
  }

  const getParticipationRate = (policy: OptionalLeavePolicy) => {
    // Assuming 100 employees for demo - in real app, you'd get this from API
    const totalEmployees = 100
    const uniqueEmployees = new Set(policy.employeeSelections.map(s => s.employee.id)).size
    return Math.round((uniqueEmployees / totalEmployees) * 100)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Optional Leave Policies
              </CardTitle>
              <CardDescription>
                Manage policies where employees can choose n holidays from k available festivals
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={() => setCreatePolicyOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Policy
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Optional Leave Policies</h3>
              <p className="text-muted-foreground mb-4">
                Create policies to let employees choose their preferred holidays from available festivals.
              </p>
              {canEdit && (
                <Button onClick={() => setCreatePolicyOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Policy
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy Name</TableHead>
                    <TableHead>Available Holidays</TableHead>
                    <TableHead>Max Selectable</TableHead>
                    <TableHead>Selection Deadline</TableHead>
                    <TableHead>Participation</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="w-[70px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{policy.name}</div>
                          {policy.description && (
                            <div className="text-sm text-muted-foreground">
                              {policy.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {policy._count.holidays} holidays
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            ({policy.holidays.map(h => h.holiday.name).slice(0, 2).join(', ')}
                            {policy._count.holidays > 2 && `, +${policy._count.holidays - 2} more`})
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {policy.maxSelectableLeaves} max
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {policy.selectionDeadline ? (
                          <div>
                            <div className="text-sm">
                              {formatDate(policy.selectionDeadline)}
                            </div>
                            {isDeadlinePassed(policy.selectionDeadline) && (
                              <Badge variant="destructive" className="text-xs mt-1">
                                Expired
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No deadline</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {policy._count.employeeSelections} selections
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            ({getParticipationRate(policy)}% participation)
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={policy.isActive ? "default" : "secondary"}>
                          {policy.isActive ? 'Active' : 'Inactive'}
                        </Badge>
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
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Policy
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Users className="mr-2 h-4 w-4" />
                                View Selections
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletingPolicy(policy)}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Policy Dialog - TODO: Implement CreateOptionalLeavePolicyDialog */}
      {createPolicyOpen && (
        <div>Create policy dialog placeholder</div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPolicy} onOpenChange={() => setDeletingPolicy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Optional Leave Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPolicy?.name}"? 
              This will remove all employee selections for this policy. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPolicy && handleDeletePolicy(deletingPolicy)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Policy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

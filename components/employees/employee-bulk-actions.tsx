'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { 
  ChevronDown, 
  UserCheck, 
  UserX, 
  Clock, 
  Trash2,
  Download,
  Mail
} from 'lucide-react'
import { toast } from 'sonner'

interface EmployeeBulkActionsProps {
  selectedEmployees: string[]
  onSelectionChange: (selected: string[]) => void
  onActionComplete: () => void
}

export function EmployeeBulkActions({ 
  selectedEmployees, 
  onSelectionChange, 
  onActionComplete 
}: EmployeeBulkActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<{
    type: string
    title: string
    description: string
  } | null>(null)

  const handleBulkAction = async (action: string) => {
    if (selectedEmployees.length === 0) {
      toast.error('No employees selected')
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch('/api/employees/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          employeeIds: selectedEmployees,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to perform bulk action')
      }

      toast.success(`Successfully ${action.toLowerCase()}d ${selectedEmployees.length} employee(s)`)
      onSelectionChange([])
      onActionComplete()
    } catch (error) {
      console.error('Bulk action error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to perform action')
    } finally {
      setIsLoading(false)
      setShowConfirmDialog(false)
      setPendingAction(null)
    }
  }

  const confirmAction = (type: string, title: string, description: string) => {
    setPendingAction({ type, title, description })
    setShowConfirmDialog(true)
  }

  const handleExport = async () => {
    if (selectedEmployees.length === 0) {
      toast.error('No employees selected')
      return
    }

    try {
      const response = await fetch('/api/employees/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeIds: selectedEmployees,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to export employees')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Employee data exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export employee data')
    }
  }

  if (selectedEmployees.length === 0) {
    return null
  }

  return (
    <>
      <div className="flex items-center gap-3 p-4 bg-muted/50 border rounded-lg">
        <Badge variant="secondary">
          {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''} selected
        </Badge>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem 
                onClick={() => confirmAction(
                  'ACTIVATE',
                  'Activate Employees',
                  `Are you sure you want to activate ${selectedEmployees.length} employee(s)?`
                )}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Activate
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => confirmAction(
                  'DEACTIVATE',
                  'Deactivate Employees',
                  `Are you sure you want to deactivate ${selectedEmployees.length} employee(s)?`
                )}
              >
                <UserX className="mr-2 h-4 w-4" />
                Deactivate
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => confirmAction(
                  'ON_LEAVE',
                  'Mark as On Leave',
                  `Are you sure you want to mark ${selectedEmployees.length} employee(s) as on leave?`
                )}
              >
                <Clock className="mr-2 h-4 w-4" />
                Mark as On Leave
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export Selected
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  // TODO: Implement bulk email functionality
                  toast.info('Bulk email feature coming soon')
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => confirmAction(
                  'DELETE',
                  'Delete Employees',
                  `Are you sure you want to permanently delete ${selectedEmployees.length} employee(s)? This action cannot be undone.`
                )}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onSelectionChange([])}
          >
            Clear Selection
          </Button>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingAction && handleBulkAction(pendingAction.type)}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
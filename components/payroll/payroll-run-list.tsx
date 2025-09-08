'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Eye, 
  Trash2, 
  Users,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'

interface PayrollRun {
  id: string
  period: string
  startDate: string
  endDate: string
  status: 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  processedAt?: string
  processedBy?: string
  totalGross?: number
  totalNet?: number
  totalDeductions?: number
  employeeCount?: number
  createdAt: string
  updatedAt: string
  _count: {
    payrollRecords: number
  }
}

interface PayrollRunListProps {
  payrollRuns: PayrollRun[]
  onView: (run: PayrollRun) => void
  onDelete: (runId: string) => Promise<void>
  onCreate: () => void
  isLoading?: boolean
}

export function PayrollRunList({
  payrollRuns,
  onView,
  onDelete,
  onCreate,
  isLoading = false,
}: PayrollRunListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredRuns = payrollRuns.filter(run =>
    run.period.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDelete = async () => {
    if (!deleteRunId) return

    try {
      setIsDeleting(true)
      await onDelete(deleteRunId)
      setDeleteRunId(null)
    } catch (error) {
      console.error('Error deleting payroll run:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return '₹0'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusIcon = (status: PayrollRun['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'PROCESSING':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'CANCELLED':
        return <XCircle className="h-4 w-4 text-gray-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-orange-600" />
    }
  }

  const getStatusBadge = (status: PayrollRun['status']) => {
    const variants = {
      DRAFT: 'secondary',
      PROCESSING: 'default',
      COMPLETED: 'default',
      FAILED: 'destructive',
      CANCELLED: 'secondary',
    } as const

    const colors = {
      DRAFT: 'bg-orange-100 text-orange-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    }

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status}
      </Badge>
    )
  }

  const canDelete = (run: PayrollRun) => {
    return ['DRAFT', 'FAILED'].includes(run.status)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Payroll Runs</CardTitle>
            <Button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              New Payroll Run
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by period..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Total Gross</TableHead>
                  <TableHead>Total Net</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No payroll runs found matching your search.' : 'No payroll runs found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{run.period}</div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(run.startDate), 'MMM d')} - {format(new Date(run.endDate), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(run.status)}
                          {getStatusBadge(run.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span>{run.employeeCount || run._count.payrollRecords}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-600">
                            {formatCurrency(run.totalGross)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-600">
                            {formatCurrency(run.totalNet)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {run.processedAt ? (
                          <div className="text-sm">
                            <div>{format(new Date(run.processedAt), 'MMM d, yyyy')}</div>
                            <div className="text-gray-500">{format(new Date(run.processedAt), 'h:mm a')}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(run)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteRunId(run.id)}
                              disabled={!canDelete(run)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteRunId} onOpenChange={() => setDeleteRunId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Run</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payroll run? This action cannot be undone and will remove all associated payroll records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
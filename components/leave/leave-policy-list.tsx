'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Users, Calendar, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/data-table'
import { LeavePolicyForm } from './leave-policy-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

interface LeavePolicy {
  id: string
  name: string
  code: string
  type: string
  description?: string
  daysPerYear: number
  carryForward: boolean
  maxCarryForward?: number
  maxConsecutiveDays?: number
  minAdvanceNotice?: number
  requiresApproval: boolean
  approvalLevels: number
  accrualType: string
  accrualRate?: number
  probationPeriodDays?: number
  gender?: string
  isEncashable: boolean
  encashmentRate?: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: {
    leaveRequests: number
    leaveBalances: number
  }
}

export function LeavePolicyList() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const { toast } = useToast()

  const fetchPolicies = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leave/policies?includeInactive=${includeInactive}`)
      if (response.ok) {
        const data = await response.json()
        setPolicies(data)
      } else {
        throw new Error('Failed to fetch leave policies')
      }
    } catch (error) {
      console.error('Error fetching policies:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch leave policies',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPolicies()
  }, [includeInactive])

  const handleDelete = async (policyId: string) => {
    try {
      const response = await fetch(`/api/leave/policies/${policyId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: 'Success',
          description: result.message || 'Leave policy deleted successfully',
        })
        fetchPolicies()
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
    }
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingPolicy(null)
    fetchPolicies()
    toast({
      title: 'Success',
      description: editingPolicy ? 'Policy updated successfully' : 'Policy created successfully',
    })
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ANNUAL: 'bg-blue-100 text-blue-800',
      SICK: 'bg-red-100 text-red-800',
      CASUAL: 'bg-green-100 text-green-800',
      MATERNITY: 'bg-pink-100 text-pink-800',
      PATERNITY: 'bg-purple-100 text-purple-800',
      EMERGENCY: 'bg-orange-100 text-orange-800',
      COMPENSATORY: 'bg-yellow-100 text-yellow-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const getAccrualTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ANNUAL: 'Annual',
      MONTHLY: 'Monthly',
      QUARTERLY: 'Quarterly',
      ON_JOINING: 'On Joining',
    }
    return labels[type] || type
  }

  const columns = [
    {
      key: 'name',
      accessorKey: 'name',
      header: 'Policy Name',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-sm text-muted-foreground">{row.original.code}</span>
        </div>
      ),
    },
    {
      key: 'type',
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }: any) => (
        <Badge className={getTypeColor(row.original.type)}>
          {row.original.type}
        </Badge>
      ),
    },
    {
      key: 'daysPerYear',
      accessorKey: 'daysPerYear',
      header: 'Days/Year',
      cell: ({ row }: any) => (
        <div className="text-center">
          <span className="font-medium">{row.original.daysPerYear}</span>
          {row.original.carryForward && (
            <div className="text-xs text-muted-foreground">
              CF: {row.original.maxCarryForward || 'Unlimited'}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'accrualType',
      accessorKey: 'accrualType',
      header: 'Accrual',
      cell: ({ row }: any) => (
        <div className="text-sm">
          <div>{getAccrualTypeLabel(row.original.accrualType)}</div>
          {row.original.accrualRate && (
            <div className="text-muted-foreground">
              {row.original.accrualRate}/month
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'requiresApproval',
      accessorKey: 'requiresApproval',
      header: 'Approval',
      cell: ({ row }: any) => (
        <div className="text-sm">
          {row.original.requiresApproval ? (
            <Badge variant="outline">
              {row.original.approvalLevels} Level{row.original.approvalLevels > 1 ? 's' : ''}
            </Badge>
          ) : (
            <Badge variant="secondary">No Approval</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'usage',
      accessorKey: 'usage',
      header: 'Usage',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{row.original._count.leaveBalances}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{row.original._count.leaveRequests}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'isActive',
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }: any) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingPolicy(row.original)
              setShowForm(true)
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Leave Policy</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the policy "{row.original.name}"?
                  {row.original._count.leaveRequests > 0 || row.original._count.leaveBalances > 0
                    ? ' This policy has associated data and will be deactivated instead of deleted.'
                    : ' This action cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(row.original.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leave Policies</h2>
          <p className="text-muted-foreground">
            Configure and manage leave policies for your organization
          </p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPolicy(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPolicy ? 'Edit Leave Policy' : 'Create Leave Policy'}
              </DialogTitle>
            </DialogHeader>
            <LeavePolicyForm
              policy={editingPolicy}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setShowForm(false)
                setEditingPolicy(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policies.length}</div>
            <p className="text-xs text-muted-foreground">
              {policies.filter(p => p.isActive).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {policies.reduce((sum, p) => sum + p._count.leaveBalances, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              With leave balances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leave Requests</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {policies.reduce((sum, p) => sum + p._count.leaveRequests, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Encashable Policies</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {policies.filter(p => p.isEncashable).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Can be encashed
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Leave Policies</CardTitle>
              <CardDescription>
                Manage leave policies and their configurations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIncludeInactive(!includeInactive)}
              >
                {includeInactive ? 'Hide Inactive' : 'Show Inactive'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<LeavePolicy>
            columns={columns}
            data={policies}
            loading={loading}
            searchKey="name"
            searchPlaceholder="Search policies..."
          />
        </CardContent>
      </Card>
    </div>
  )
}
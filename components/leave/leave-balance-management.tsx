'use client'

import { useState, useEffect } from 'react'
import { Calendar, Users, TrendingUp, AlertCircle, Edit, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Progress } from '@/components/ui/progress'

interface LeaveBalance {
  id: string
  employeeId: string
  policyId: string
  year: number
  allocated: number
  used: number
  pending: number
  carriedForward: number
  encashed: number
  expired: number
  available: number
  lastAccrualDate?: string
  policy: {
    id: string
    name: string
    code: string
    type: string
    daysPerYear: number
    carryForward: boolean
    maxCarryForward?: number
    isEncashable: boolean
    encashmentRate?: number
  }
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
  }
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
}

interface LeavePolicy {
  id: string
  name: string
  code: string
  type: string
}

export function LeaveBalanceManagement() {
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [policies, setPolicies] = useState<LeavePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const { toast } = useToast()

  const fetchBalances = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedEmployee) params.append('employeeId', selectedEmployee)
      if (selectedYear) params.append('year', selectedYear)

      const response = await fetch(`/api/leave/balances?${params}`)
      if (response.ok) {
        const data = await response.json()
        setBalances(data)
      } else {
        throw new Error('Failed to fetch leave balances')
      }
    } catch (error) {
      console.error('Error fetching balances:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch leave balances',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees?status=ACTIVE')
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchPolicies = async () => {
    try {
      const response = await fetch('/api/leave/policies')
      if (response.ok) {
        const data = await response.json()
        setPolicies(data)
      }
    } catch (error) {
      console.error('Error fetching policies:', error)
    }
  }

  useEffect(() => {
    fetchEmployees()
    fetchPolicies()
  }, [])

  useEffect(() => {
    fetchBalances()
  }, [selectedEmployee, selectedYear])

  const handleUpdateBalance = async (balanceId: string, updates: Partial<LeaveBalance>) => {
    try {
      const balance = balances.find(b => b.id === balanceId)
      if (!balance) return

      const response = await fetch('/api/leave/balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: balance.employeeId,
          policyId: balance.policyId,
          year: balance.year,
          ...updates,
        }),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Leave balance updated successfully',
        })
        fetchBalances()
        setShowEditDialog(false)
        setEditingBalance(null)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update balance')
      }
    } catch (error) {
      console.error('Error updating balance:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update balance',
        variant: 'destructive',
      })
    }
  }

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 80) return 'text-red-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getUtilizationBadgeColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-red-100 text-red-800'
    if (percentage >= 60) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const columns = [
    {
      key: 'employee',
      accessorKey: 'employee',
      header: 'Employee',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.employee.firstName} {row.original.employee.lastName}
          </span>
          <span className="text-sm text-muted-foreground">
            {row.original.employee.employeeCode}
          </span>
        </div>
      ),
    },
    {
      key: 'policy',
      accessorKey: 'policy',
      header: 'Leave Type',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.policy.name}</span>
          <Badge variant="outline" className="w-fit">
            {row.original.policy.code}
          </Badge>
        </div>
      ),
    },
    {
      key: 'allocated',
      accessorKey: 'allocated',
      header: 'Allocated',
      cell: ({ row }: any) => (
        <div className="text-center">
          <span className="font-medium">{row.original.allocated}</span>
          {row.original.carriedForward > 0 && (
            <div className="text-xs text-muted-foreground">
              +{row.original.carriedForward} CF
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'used',
      accessorKey: 'used',
      header: 'Used',
      cell: ({ row }: any) => {
        const total = Number(row.original.allocated) + Number(row.original.carriedForward)
        const used = Number(row.original.used)
        const percentage = total > 0 ? (used / total) * 100 : 0

        return (
          <div className="text-center">
            <span className={`font-medium ${getUtilizationColor(percentage)}`}>
              {used}
            </span>
            <div className="text-xs text-muted-foreground">
              {percentage.toFixed(0)}%
            </div>
          </div>
        )
      },
    },
    {
      key: 'pending',
      accessorKey: 'pending',
      header: 'Pending',
      cell: ({ row }: any) => (
        <div className="text-center">
          <span className="font-medium">{row.original.pending}</span>
          {row.original.pending > 0 && (
            <Badge variant="outline" className="ml-1 text-xs">
              Pending
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'available',
      accessorKey: 'available',
      header: 'Available',
      cell: ({ row }: any) => {
        const available = Number(row.original.available)
        const total = Number(row.original.allocated) + Number(row.original.carriedForward)
        const percentage = total > 0 ? (available / total) * 100 : 0

        return (
          <div className="text-center">
            <span className="font-medium text-green-600">{available}</span>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-green-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              ></div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'utilization',
      accessorKey: 'utilization',
      header: 'Utilization',
      cell: ({ row }: any) => {
        const total = Number(row.original.allocated) + Number(row.original.carriedForward)
        const used = Number(row.original.used)
        const percentage = total > 0 ? (used / total) * 100 : 0

        return (
          <Badge className={getUtilizationBadgeColor(percentage)}>
            {percentage.toFixed(0)}%
          </Badge>
        )
      },
    },
    {
      key: 'expired',
      accessorKey: 'expired',
      header: 'Expired',
      cell: ({ row }: any) => (
        <div className="text-center">
          {row.original.expired > 0 ? (
            <span className="text-red-600 font-medium">{row.original.expired}</span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </div>
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
              setEditingBalance(row.original)
              setShowEditDialog(true)
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const totalAllocated = balances.reduce((sum, b) => sum + Number(b.allocated) + Number(b.carriedForward), 0)
  const totalUsed = balances.reduce((sum, b) => sum + Number(b.used), 0)
  const totalPending = balances.reduce((sum, b) => sum + Number(b.pending), 0)
  const totalAvailable = balances.reduce((sum, b) => sum + Number(b.available), 0)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leave Balance Management</h2>
          <p className="text-muted-foreground">
            Monitor and manage employee leave balances
          </p>
        </div>
        <Button onClick={fetchBalances} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter leave balances by employee and year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Employees</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName} ({employee.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Allocated</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAllocated}</div>
            <p className="text-xs text-muted-foreground">
              Including carry forward
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalUsed}</div>
            <p className="text-xs text-muted-foreground">
              {totalAllocated > 0 ? ((totalUsed / totalAllocated) * 100).toFixed(1) : 0}% utilization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{totalPending}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalAvailable}</div>
            <p className="text-xs text-muted-foreground">
              Ready to use
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Balances</CardTitle>
          <CardDescription>
            Detailed view of employee leave balances for {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<LeaveBalance>
            columns={columns}
            data={balances}
            loading={loading}
            searchKey="employee.firstName"
            searchPlaceholder="Search employees..."
          />
        </CardContent>
      </Card>

      {/* Edit Balance Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Leave Balance</DialogTitle>
          </DialogHeader>
          {editingBalance && (
            <EditBalanceForm
              balance={editingBalance}
              onSave={(updates) => handleUpdateBalance(editingBalance.id, updates)}
              onCancel={() => {
                setShowEditDialog(false)
                setEditingBalance(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface EditBalanceFormProps {
  balance: LeaveBalance
  onSave: (updates: Partial<LeaveBalance>) => void
  onCancel: () => void
}

function EditBalanceForm({ balance, onSave, onCancel }: EditBalanceFormProps) {
  const [allocated, setAllocated] = useState(balance.allocated.toString())
  const [used, setUsed] = useState(balance.used.toString())
  const [pending, setPending] = useState(balance.pending.toString())
  const [carriedForward, setCarriedForward] = useState(balance.carriedForward.toString())
  const [encashed, setEncashed] = useState(balance.encashed.toString())
  const [expired, setExpired] = useState(balance.expired.toString())

  const handleSave = () => {
    onSave({
      allocated: Number(allocated),
      used: Number(used),
      pending: Number(pending),
      carriedForward: Number(carriedForward),
      encashed: Number(encashed),
      expired: Number(expired),
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Allocated Days</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={allocated}
            onChange={(e) => setAllocated(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Used Days</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={used}
            onChange={(e) => setUsed(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Pending Days</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={pending}
            onChange={(e) => setPending(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Carried Forward</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={carriedForward}
            onChange={(e) => setCarriedForward(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Encashed Days</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={encashed}
            onChange={(e) => setEncashed(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Expired Days</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={expired}
            onChange={(e) => setExpired(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  )
}
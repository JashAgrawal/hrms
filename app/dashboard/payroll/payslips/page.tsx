'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import BulkPayslipManager from '@/components/payroll/bulk-payslip-manager'
import {
  FileText,
  Search,
  Filter,
  Calendar,
  Users,
  Mail,
  Download,
  Eye,
  RefreshCw,
} from 'lucide-react'

interface PayrollRun {
  id: string
  period: string
  startDate: string
  endDate: string
  status: string
  employeeCount: number
  totalGross: number
  totalNet: number
  processedAt?: string
  payslipStats?: {
    total: number
    generated: number
    emailsSent: number
    distributionRate: number
  }
}

export default function PayslipsPage() {
  const { data: session } = useSession()
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([])
  const [filteredRuns, setFilteredRuns] = useState<PayrollRun[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null)

  useEffect(() => {
    fetchPayrollRuns()
  }, [])

  useEffect(() => {
    filterPayrollRuns()
  }, [payrollRuns, searchTerm, statusFilter])

  const fetchPayrollRuns = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/payroll/runs')
      if (response.ok) {
        const data = await response.json()
        // Only show completed payroll runs
        const completedRuns = data.payrollRuns.filter((run: PayrollRun) => 
          ['APPROVED', 'PAID'].includes(run.status)
        )
        
        // Fetch payslip stats for each run
        const runsWithStats = await Promise.all(
          completedRuns.map(async (run: PayrollRun) => {
            try {
              const statsResponse = await fetch(`/api/payroll/payslips/distribute?payrollRunId=${run.id}`)
              if (statsResponse.ok) {
                const statsData = await statsResponse.json()
                return {
                  ...run,
                  payslipStats: statsData.distributionStatus,
                }
              }
            } catch (error) {
              console.error(`Error fetching stats for run ${run.id}:`, error)
            }
            return run
          })
        )
        
        setPayrollRuns(runsWithStats)
      } else {
        setError('Failed to fetch payroll runs')
      }
    } catch (error) {
      console.error('Error fetching payroll runs:', error)
      setError('An error occurred while fetching payroll runs')
    } finally {
      setIsLoading(false)
    }
  }

  const filterPayrollRuns = () => {
    let filtered = payrollRuns

    if (searchTerm) {
      filtered = filtered.filter(run =>
        run.period.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(run => run.status === statusFilter)
    }

    setFilteredRuns(filtered)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      APPROVED: { variant: 'default' as const, label: 'Approved' },
      PAID: { variant: 'default' as const, label: 'Paid' },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: 'secondary' as const,
      label: status,
    }
    
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (selectedRun) {
    return (
      <BulkPayslipManager
        payrollRunId={selectedRun.id}
        payrollRunPeriod={formatPeriod(selectedRun.period)}
        onClose={() => setSelectedRun(null)}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payslip Management</h1>
          <p className="text-gray-600">Generate and distribute employee payslips</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading payroll runs...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payslip Management</h1>
          <p className="text-gray-600">Generate and distribute employee payslips</p>
        </div>
        <Button onClick={fetchPayrollRuns} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by period..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Runs Table */}
      {filteredRuns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Payroll Runs Found</h3>
            <p className="text-gray-600 text-center max-w-md">
              {payrollRuns.length === 0
                ? 'No approved or paid payroll runs available for payslip generation.'
                : 'No payroll runs match your current filters.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Payroll Runs</span>
              <Badge variant="outline">{filteredRuns.length}</Badge>
            </CardTitle>
            <CardDescription>
              Select a payroll run to manage its payslips
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Total Gross</TableHead>
                  <TableHead>Total Net</TableHead>
                  <TableHead>Payslip Status</TableHead>
                  <TableHead>Email Distribution</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <div className="font-medium">{formatPeriod(run.period)}</div>
                      <div className="text-sm text-gray-600">
                        {formatDate(run.startDate)} - {formatDate(run.endDate)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{run.employeeCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(run.totalGross || 0)}</TableCell>
                    <TableCell>{formatCurrency(run.totalNet || 0)}</TableCell>
                    <TableCell>
                      {run.payslipStats ? (
                        <div className="text-sm">
                          <div className="font-medium">
                            {run.payslipStats.generated} / {run.payslipStats.total} Generated
                          </div>
                          <div className="text-gray-600">
                            {((run.payslipStats.generated / run.payslipStats.total) * 100).toFixed(0)}% Complete
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline">Not Generated</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {run.payslipStats ? (
                        <div className="text-sm">
                          <div className="font-medium">
                            {run.payslipStats.emailsSent} / {run.payslipStats.generated} Sent
                          </div>
                          <div className="text-gray-600">
                            {run.payslipStats.distributionRate}% Distributed
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => setSelectedRun(run)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
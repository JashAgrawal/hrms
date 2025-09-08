'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useParams } from 'next/navigation'
import { PayrollApprovalWorkflow } from '@/components/payroll/payroll-approval-workflow'
import { PayrollFinalization } from '@/components/payroll/payroll-finalization'
import BulkPayslipManager from '@/components/payroll/bulk-payslip-manager'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  ArrowLeft, 
  Users, 
  DollarSign, 
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  CreditCard
} from 'lucide-react'
import Link from 'next/link'
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
  payrollRecords: Array<{
    id: string
    employeeId: string
    basicSalary: number
    grossSalary: number
    netSalary: number
    totalEarnings: number
    totalDeductions: number
    workingDays: number
    presentDays: number
    absentDays: number
    overtimeHours?: number
    overtimeAmount?: number
    lopDays?: number
    lopAmount?: number
    pfDeduction?: number
    esiDeduction?: number
    tdsDeduction?: number
    ptDeduction?: number
    status: string
    earnings: any
    deductions: any
    employee: {
      id: string
      employeeCode: string
      firstName: string
      lastName: string
      email: string
      designation: string
      department: {
        name: string
        code: string
      }
    }
  }>
}

export default function PayrollRunDetailsPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const runId = params.id as string

  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showApprovalWorkflow, setShowApprovalWorkflow] = useState(false)
  const [showFinalization, setShowFinalization] = useState(false)
  const [showPayslipManager, setShowPayslipManager] = useState(false)

  // Redirect if not authenticated or doesn't have permission
  useEffect(() => {
    if (runId) {
      fetchPayrollRun()
    }
  }, [runId])

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  const fetchPayrollRun = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/payroll/runs/${runId}`)
      if (response.ok) {
        const data = await response.json()
        setPayrollRun(data)
      } else {
        console.error('Failed to fetch payroll run')
      }
    } catch (error) {
      console.error('Error fetching payroll run:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprovalComplete = (result: any) => {
    console.log('Approval completed:', result)
    setShowApprovalWorkflow(false)
    fetchPayrollRun() // Refresh data
  }

  const handleFinalizationComplete = (result: any) => {
    console.log('Finalization completed:', result)
    setShowFinalization(false)
    fetchPayrollRun() // Refresh data
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
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'PROCESSING':
        return <Clock className="h-5 w-5 text-blue-600" />
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'CANCELLED':
        return <XCircle className="h-5 w-5 text-gray-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-orange-600" />
    }
  }

  const getStatusBadge = (status: PayrollRun['status']) => {
    const colors = {
      DRAFT: 'bg-orange-100 text-orange-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    }

    return (
      <Badge className={colors[status]}>
        {status}
      </Badge>
    )
  }

  const canApprove = (run: PayrollRun) => {
    return run.status === 'COMPLETED' && ['ADMIN', 'FINANCE'].includes(session.user.role)
  }

  const canFinalize = (run: PayrollRun) => {
    return run.status === 'COMPLETED' && 
           run.payrollRecords.some(record => record.status === 'APPROVED') &&
           ['ADMIN', 'FINANCE'].includes(session.user.role)
  }

  const canGeneratePayslips = (run: PayrollRun) => {
    return run.status === 'COMPLETED' && 
           run.payrollRecords.some(record => ['APPROVED', 'PAID'].includes(record.status)) &&
           ['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading payroll run...</p>
        </div>
      </div>
    )
  }

  if (!payrollRun) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Payroll run not found</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/payroll/runs">Back to Payroll Runs</Link>
        </Button>
      </div>
    )
  }

  if (showApprovalWorkflow) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => setShowApprovalWorkflow(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Details
          </Button>
        </div>
        <PayrollApprovalWorkflow
          payrollRun={payrollRun}
          onApprovalComplete={handleApprovalComplete}
          onCancel={() => setShowApprovalWorkflow(false)}
        />
      </div>
    )
  }

  if (showFinalization) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => setShowFinalization(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Details
          </Button>
        </div>
        <PayrollFinalization
          payrollRun={payrollRun}
          onFinalizationComplete={handleFinalizationComplete}
          onCancel={() => setShowFinalization(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/dashboard/payroll/runs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Payroll Runs
              </Link>
            </Button>
          </div>
          <div className="flex items-center space-x-4 mt-4">
            {getStatusIcon(payrollRun.status)}
            <h1 className="text-3xl font-bold tracking-tight">
              Payroll Run - {payrollRun.period}
            </h1>
            {getStatusBadge(payrollRun.status)}
          </div>
          <p className="text-gray-600 mt-2">
            {format(new Date(payrollRun.startDate), 'MMM d')} - {format(new Date(payrollRun.endDate), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex space-x-2">
          {canApprove(payrollRun) && (
            <Button 
              onClick={() => setShowApprovalWorkflow(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Review & Approve
            </Button>
          )}
          {canFinalize(payrollRun) && (
            <Button 
              onClick={() => setShowFinalization(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Finalize Payment
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Employees</span>
            </div>
            <p className="text-2xl font-bold">{payrollRun.payrollRecords.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Total Gross</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(payrollRun.totalGross)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Total Deductions</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(payrollRun.totalDeductions)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Net Payout</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(payrollRun.totalNet)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed View */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="records">Employee Records</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          {canGeneratePayslips(payrollRun) && (
            <TabsTrigger value="payslips">
              <FileText className="mr-2 h-4 w-4" />
              Payslips
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Run Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Period</label>
                    <p className="text-lg font-medium">{payrollRun.period}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">{getStatusBadge(payrollRun.status)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Pay Period</label>
                    <p className="text-lg">
                      {format(new Date(payrollRun.startDate), 'MMM d, yyyy')} - {format(new Date(payrollRun.endDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-lg">{format(new Date(payrollRun.createdAt), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                  {payrollRun.processedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Processed</label>
                      <p className="text-lg">{format(new Date(payrollRun.processedAt), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Employee Count</label>
                    <p className="text-lg font-medium">{payrollRun.payrollRecords.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Employee Payroll Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>Gross Salary</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollRun.payrollRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {record.employee.firstName} {record.employee.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {record.employee.employeeCode} • {record.employee.designation}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(record.basicSalary)}
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          {formatCurrency(record.grossSalary)}
                        </TableCell>
                        <TableCell className="font-medium text-red-600">
                          {formatCurrency(record.totalDeductions)}
                        </TableCell>
                        <TableCell className="font-medium text-blue-600">
                          {formatCurrency(record.netSalary)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{record.presentDays}/{record.workingDays} days</div>
                            {record.lopDays && record.lopDays > 0 && (
                              <div className="text-red-600">LOP: {record.lopDays}</div>
                            )}
                            {record.overtimeHours && record.overtimeHours > 0 && (
                              <div className="text-green-600">OT: {record.overtimeHours}h</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{record.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Basic Salary</span>
                    <span className="font-medium">
                      {formatCurrency(payrollRun.payrollRecords.reduce((sum, r) => sum + r.basicSalary, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Gross Salary</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(payrollRun.totalGross)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Deductions</span>
                    <span className="font-medium text-red-600">
                      {formatCurrency(payrollRun.totalDeductions)}
                    </span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Net Payout</span>
                      <span className="text-blue-600">
                        {formatCurrency(payrollRun.totalNet)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(
                    payrollRun.payrollRecords.reduce((acc, record) => {
                      acc[record.status] = (acc[record.status] || 0) + 1
                      return acc
                    }, {} as Record<string, number>)
                  ).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{status}</Badge>
                      </div>
                      <span className="font-medium">{count} employees</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payslips" className="space-y-6">
          <BulkPayslipManager 
            payrollRun={payrollRun} 
            onRefresh={fetchPayrollRun}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
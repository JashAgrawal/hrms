'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/data-table'
import { 
  Loader2, 
  Download, 
  FileText,
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Search,
  Users,
  DollarSign,
  Calculator,
  Eye,
  Mail,
  Printer
} from 'lucide-react'

const reportFilterSchema = z.object({
  reportType: z.enum(['summary', 'detailed', 'statutory', 'comparison', 'analytics']),
  period: z.string().min(1, 'Period is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  departmentId: z.string().optional(),
  employeeId: z.string().optional(),
  format: z.enum(['pdf', 'excel', 'csv']),
  includeInactive: z.boolean(),
})

type ReportFilterData = z.infer<typeof reportFilterSchema>

interface PayrollSummary {
  period: string
  totalEmployees: number
  totalGross: number
  totalNet: number
  totalDeductions: number
  averageSalary: number
  departmentBreakdown: Array<{
    departmentName: string
    employeeCount: number
    totalGross: number
    totalNet: number
    averageSalary: number
  }>
  componentBreakdown: Array<{
    componentName: string
    componentType: 'EARNING' | 'DEDUCTION'
    totalAmount: number
    averageAmount: number
    employeeCount: number
  }>
}

interface PayrollRecord {
  id: string
  employee: {
    employeeCode: string
    firstName: string
    lastName: string
    designation: string
    department: {
      name: string
    }
  }
  basicSalary: number
  grossSalary: number
  netSalary: number
  totalEarnings: number
  totalDeductions: number
  workingDays: number
  presentDays: number
  status: string
}

interface PayrollReportsProps {
  onGenerateReport: (filters: ReportFilterData) => Promise<any>
  onDownloadReport: (reportId: string, format: string) => Promise<void>
  onEmailReport: (reportId: string, emails: string[]) => Promise<void>
  departments: Array<{ id: string; name: string }>
  employees: Array<{ id: string; employeeCode: string; firstName: string; lastName: string }>
  isLoading?: boolean
}

const reportTypeOptions = [
  { 
    value: 'summary', 
    label: 'Payroll Summary', 
    description: 'High-level overview with totals and averages' 
  },
  { 
    value: 'detailed', 
    label: 'Detailed Report', 
    description: 'Employee-wise breakdown with all components' 
  },
  { 
    value: 'statutory', 
    label: 'Statutory Report', 
    description: 'PF, ESI, TDS, and other statutory deductions' 
  },
  { 
    value: 'comparison', 
    label: 'Period Comparison', 
    description: 'Compare payroll across multiple periods' 
  },
  { 
    value: 'analytics', 
    label: 'Analytics Report', 
    description: 'Trends, insights, and cost analysis' 
  },
]

const formatOptions = [
  { value: 'pdf', label: 'PDF', icon: FileText },
  { value: 'excel', label: 'Excel', icon: BarChart3 },
  { value: 'csv', label: 'CSV', icon: FileText },
]

export function PayrollReports({
  onGenerateReport,
  onDownloadReport,
  onEmailReport,
  departments,
  employees,
  isLoading = false
}: PayrollReportsProps) {
  const [reportData, setReportData] = useState<any>(null)
  const [summary, setSummary] = useState<PayrollSummary | null>(null)
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ReportFilterData>({
    resolver: zodResolver(reportFilterSchema),
    defaultValues: {
      reportType: 'summary' as const,
      period: new Date().toISOString().slice(0, 7), // Current month
      format: 'pdf' as const,
      includeInactive: false,
    },
  })

  const watchedReportType = watch('reportType')
  const watchedPeriod = watch('period')

  const handleGenerateReport = async (data: ReportFilterData) => {
    try {
      setIsGenerating(true)
      setError(null)
      
      const result = await onGenerateReport(data)
      setReportData(result)
      
      if (result.summary) {
        setSummary(result.summary)
      }
      
      if (result.records) {
        setRecords(result.records)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async (format: string) => {
    if (reportData?.id) {
      try {
        await onDownloadReport(reportData.id, format)
      } catch (err) {
        setError('Failed to download report')
      }
    }
  }

  const handleEmail = async (emails: string[]) => {
    if (reportData?.id) {
      try {
        await onEmailReport(reportData.id, emails)
      } catch (err) {
        setError('Failed to email report')
      }
    }
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
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
    })
  }

  // Columns for detailed report table
  const detailedReportColumns = [
    {
      key: 'employee',
      header: 'Employee',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.employee.firstName} {row.original.employee.lastName}</span>
          <span className="text-sm text-gray-500">{row.original.employee.employeeCode}</span>
        </div>
      ),
    },
    {
      key: 'designation',
      header: 'Designation',
      cell: ({ row }: any) => row.original.employee.designation,
    },
    {
      key: 'department',
      header: 'Department',
      cell: ({ row }: any) => row.original.employee.department.name,
    },
    {
      key: 'basicSalary',
      header: 'Basic Salary',
      cell: ({ row }: any) => formatCurrency(row.original.basicSalary),
    },
    {
      key: 'grossSalary',
      header: 'Gross Salary',
      cell: ({ row }: any) => formatCurrency(row.original.grossSalary),
    },
    {
      key: 'totalDeductions',
      header: 'Deductions',
      cell: ({ row }: any) => formatCurrency(row.original.totalDeductions),
    },
    {
      key: 'netSalary',
      header: 'Net Salary',
      cell: ({ row }: any) => (
        <span className="font-medium text-green-600">
          {formatCurrency(row.original.netSalary)}
        </span>
      ),
    },
    {
      key: 'attendance',
      header: 'Attendance',
      cell: ({ row }: any) => (
        <span className="text-sm">
          {row.original.presentDays}/{row.original.workingDays}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: ({ row }: any) => (
        <Badge variant={row.original.status === 'PAID' ? 'default' : 'secondary'}>
          {row.original.status}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Payroll Reports
          </h1>
          <p className="text-muted-foreground">
            Generate comprehensive payroll reports and analytics
          </p>
        </div>
      </div>

      {/* Report Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handleGenerateReport)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reportType">Report Type *</Label>
                <Select
                  value={watch('reportType')}
                  onValueChange={(value) => setValue('reportType', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-gray-500">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.reportType && (
                  <p className="text-sm text-red-600">{errors.reportType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Period *</Label>
                <Input
                  id="period"
                  type="month"
                  {...register('period')}
                />
                {errors.period && (
                  <p className="text-sm text-red-600">{errors.period.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="format">Format *</Label>
                <Select
                  value={watch('format')}
                  onValueChange={(value) => setValue('format', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {formatOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center space-x-2">
                          <option.icon className="h-4 w-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Additional Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departmentId">Department (Optional)</Label>
                <Select
                  value={watch('departmentId')}
                  onValueChange={(value) => setValue('departmentId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee (Optional)</Label>
                <Select
                  value={watch('employeeId')}
                  onValueChange={(value) => setValue('employeeId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Employees</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range for Comparison Reports */}
            {watchedReportType === 'comparison' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="month"
                    {...register('startDate')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="month"
                    {...register('endDate')}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeInactive"
                {...register('includeInactive')}
                className="rounded border-gray-300"
              />
              <Label htmlFor="includeInactive" className="text-sm font-normal">
                Include inactive employees
              </Label>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isGenerating || isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <BarChart3 className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Report Results */}
      {reportData && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {reportTypeOptions.find(opt => opt.value === watchedReportType)?.label}
              </h2>
              <p className="text-gray-600">
                Period: {formatPeriod(watchedPeriod)}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => handleDownload('pdf')}
              >
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload('excel')}
              >
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload('csv')}
              >
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => window.print()}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>

          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="detailed">Detailed</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-4">
              {summary && (
                <>
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Total Employees</span>
                        </div>
                        <p className="text-2xl font-bold">{summary.totalEmployees}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">Total Gross</span>
                        </div>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(summary.totalGross)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium">Total Deductions</span>
                        </div>
                        <p className="text-2xl font-bold text-red-600">
                          {formatCurrency(summary.totalDeductions)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Total Net</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatCurrency(summary.totalNet)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Department Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Department-wise Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {summary.departmentBreakdown.map((dept, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <span className="font-medium">{dept.departmentName}</span>
                              <p className="text-sm text-gray-600">{dept.employeeCount} employees</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(dept.totalNet)}</p>
                              <p className="text-sm text-gray-600">
                                Avg: {formatCurrency(dept.averageSalary)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Detailed Tab */}
            <TabsContent value="detailed" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Employee-wise Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={detailedReportColumns}
                    data={records}
                    searchKey="employee"
                    searchPlaceholder="Search employees..."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Salary Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span>Average Salary</span>
                        <span className="font-medium">
                          {summary && formatCurrency(summary.averageSalary)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Median Salary</span>
                        <span className="font-medium">
                          {formatCurrency(50000)} {/* Calculate actual median */}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Salary Range</span>
                        <span className="font-medium">
                          {formatCurrency(25000)} - {formatCurrency(150000)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cost Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span>Total Payroll Cost</span>
                        <span className="font-medium">
                          {summary && formatCurrency(summary.totalGross)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Cost per Employee</span>
                        <span className="font-medium">
                          {summary && formatCurrency(summary.totalGross / summary.totalEmployees)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Deduction Rate</span>
                        <span className="font-medium">
                          {summary && ((summary.totalDeductions / summary.totalGross) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
'use client'

import { useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Loader2, 
  Calculator, 
  Users, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

const payrollCalculationSchema = z.object({
  employeeId: z.string().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
})

type PayrollCalculationFormData = z.infer<typeof payrollCalculationSchema>

interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  designation: string
  department: {
    name: string
  }
}

interface PayrollCalculationResult {
  employeeId: string
  period: string
  basicSalary: number
  grossSalary: number
  totalEarnings: number
  totalDeductions: number
  netSalary: number
  workingDays: number
  presentDays: number
  absentDays: number
  lopDays: number
  lopAmount: number
  overtimeHours: number
  overtimeAmount: number
  components: Array<{
    componentId: string
    componentName: string
    componentCode: string
    type: 'EARNING' | 'DEDUCTION'
    category: string
    baseValue: number
    calculatedValue: number
    isProrated: boolean
    isStatutory: boolean
  }>
  statutoryDeductions: {
    pf: number
    esi: number
    tds: number
    pt: number
  }
}

interface PayrollCalculatorProps {
  employees: Employee[]
  onCalculationComplete?: (result: PayrollCalculationResult) => void
}

export function PayrollCalculator({ employees, onCalculationComplete }: PayrollCalculatorProps) {
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculationResult, setCalculationResult] = useState<PayrollCalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<PayrollCalculationFormData>({
    resolver: zodResolver(payrollCalculationSchema),
    defaultValues: {
      period: new Date().toISOString().slice(0, 7), // Current month
    },
  })

  const selectedEmployeeId = watch('employeeId')
  const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId)

  const handleCalculate = async (data: PayrollCalculationFormData) => {
    if (!data.employeeId) {
      setError('Please select an employee')
      return
    }

    try {
      setIsCalculating(true)
      setError(null)
      setCalculationResult(null)

      // Calculate period dates
      const [year, month] = data.period.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      const response = await fetch('/api/payroll/calculate?single=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: data.employeeId,
          period: data.period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to calculate payroll')
      }

      const result = await response.json()
      setCalculationResult(result)
      onCalculationComplete?.(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCalculating(false)
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

  const getComponentIcon = (type: string) => {
    return type === 'EARNING' ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>Payroll Calculator</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handleCalculate)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee *</Label>
                <Select
                  value={selectedEmployeeId}
                  onValueChange={(value) => setValue('employeeId', value)}
                  disabled={isCalculating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        <div className="flex flex-col">
                          <span>{employee.firstName} {employee.lastName}</span>
                          <span className="text-xs text-gray-500">
                            {employee.employeeCode} • {employee.designation}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.employeeId && (
                  <p className="text-sm text-red-600">{errors.employeeId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Period *</Label>
                <Input
                  id="period"
                  type="month"
                  {...register('period')}
                  disabled={isCalculating}
                />
                {errors.period && (
                  <p className="text-sm text-red-600">{errors.period.message}</p>
                )}
              </div>
            </div>

            {selectedEmployee && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-600" />
                  <span className="font-medium">{selectedEmployee.firstName} {selectedEmployee.lastName}</span>
                  <Badge variant="outline">{selectedEmployee.employeeCode}</Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedEmployee.designation} • {selectedEmployee.department.name}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isCalculating || !selectedEmployeeId}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isCalculating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Calculate Payroll
            </Button>
          </form>
        </CardContent>
      </Card>

      {calculationResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Gross Salary</span>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(calculationResult.grossSalary)}
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
                  {formatCurrency(calculationResult.totalDeductions)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Net Salary</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(calculationResult.netSalary)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Present Days</span>
                </div>
                <p className="text-2xl font-bold">
                  {calculationResult.presentDays}/{calculationResult.workingDays}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Earnings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Earnings</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {calculationResult.components
                    .filter(c => c.type === 'EARNING')
                    .map((component) => (
                      <div key={component.componentId} className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{component.componentName}</span>
                          {component.isProrated && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Prorated
                            </Badge>
                          )}
                        </div>
                        <span className="font-medium text-green-600">
                          {formatCurrency(component.calculatedValue)}
                        </span>
                      </div>
                    ))}
                  
                  {calculationResult.overtimeAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">Overtime</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({calculationResult.overtimeHours} hrs)
                        </span>
                      </div>
                      <span className="font-medium text-green-600">
                        {formatCurrency(calculationResult.overtimeAmount)}
                      </span>
                    </div>
                  )}
                  
                  <Separator />
                  <div className="flex justify-between items-center font-bold">
                    <span>Total Earnings</span>
                    <span className="text-green-600">
                      {formatCurrency(calculationResult.totalEarnings)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deductions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span>Deductions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {calculationResult.components
                    .filter(c => c.type === 'DEDUCTION')
                    .map((component) => (
                      <div key={component.componentId} className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{component.componentName}</span>
                          {component.isStatutory && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Statutory
                            </Badge>
                          )}
                        </div>
                        <span className="font-medium text-red-600">
                          {formatCurrency(component.calculatedValue)}
                        </span>
                      </div>
                    ))}
                  
                  {calculationResult.lopAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">Loss of Pay</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({calculationResult.lopDays} days)
                        </span>
                      </div>
                      <span className="font-medium text-red-600">
                        {formatCurrency(calculationResult.lopAmount)}
                      </span>
                    </div>
                  )}
                  
                  <Separator />
                  <div className="flex justify-between items-center font-bold">
                    <span>Total Deductions</span>
                    <span className="text-red-600">
                      {formatCurrency(calculationResult.totalDeductions)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{calculationResult.presentDays}</p>
                  <p className="text-sm text-gray-600">Present Days</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{calculationResult.absentDays}</p>
                  <p className="text-sm text-gray-600">Absent Days</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{calculationResult.lopDays}</p>
                  <p className="text-sm text-gray-600">LOP Days</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{calculationResult.overtimeHours}</p>
                  <p className="text-sm text-gray-600">Overtime Hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
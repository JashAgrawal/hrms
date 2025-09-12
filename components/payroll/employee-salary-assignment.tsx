'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmployeeSelect } from '@/components/ui/employee-select'
import { DepartmentSelect } from '@/components/ui/department-select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DataTable } from '@/components/shared/data-table'
import { 
  Loader2, 
  Plus, 
  Edit,
  Trash2,
  Users,
  Calculator,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Info,
  Search,
  Filter,
  Download,
  Upload,
  History
} from 'lucide-react'

// Schema for salary assignment
const salaryAssignmentSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  structureId: z.string().min(1, 'Salary structure is required'),
  ctc: z.number().min(1, 'CTC must be greater than 0'),
  effectiveFrom: z.string().min(1, 'Effective date is required'),
  effectiveTo: z.string().optional(),
  revisionReason: z.string().optional(),
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
  // Component overrides
  componentOverrides: z.array(z.object({
    componentId: z.string(),
    value: z.number(),
    reason: z.string().optional(),
  })).optional(),
})

type SalaryAssignmentFormData = z.infer<typeof salaryAssignmentSchema>

interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  designation: string
  department: {
    id: string
    name: string
  }
  currentSalary?: {
    id: string
    ctc: number
    structure: {
      id: string
      name: string
    }
    effectiveFrom: string
    effectiveTo?: string
  }
}

interface SalaryStructure {
  id: string
  name: string
  code: string
  description?: string
  grade?: {
    id: string
    name: string
    minSalary: number
    maxSalary: number
  }
  components: Array<{
    id: string
    component: {
      id: string
      name: string
      code: string
      type: string
      calculationType: string
    }
    value?: number
    percentage?: number
    baseComponent?: string
    isVariable: boolean
  }>
}

interface SalaryAssignment {
  id: string
  employee: Employee
  structure: SalaryStructure
  ctc: number
  effectiveFrom: string
  effectiveTo?: string
  revisionReason?: string
  approvedBy?: string
  approvedAt?: string
  isActive: boolean
  createdAt: string
  components?: Array<{
    componentId: string
    value: number
    isOverride: boolean
  }>
}

interface EmployeeSalaryAssignmentProps {
  employees: Employee[]
  salaryStructures: SalaryStructure[]
  assignments: SalaryAssignment[]
  onAssign: (data: SalaryAssignmentFormData) => Promise<void>
  onUpdate: (id: string, data: Partial<SalaryAssignmentFormData>) => Promise<void>
  onRevoke: (id: string, reason: string) => Promise<void>
  onBulkAssign?: (assignments: SalaryAssignmentFormData[]) => Promise<void>
  isLoading?: boolean
}

const revisionReasonOptions = [
  { value: 'INCREMENT', label: 'Annual Increment' },
  { value: 'PROMOTION', label: 'Promotion' },
  { value: 'MARKET_CORRECTION', label: 'Market Correction' },
  { value: 'PERFORMANCE_BONUS', label: 'Performance Bonus' },
  { value: 'ROLE_CHANGE', label: 'Role Change' },
  { value: 'LOCATION_CHANGE', label: 'Location Change' },
  { value: 'OTHER', label: 'Other' },
]

export function EmployeeSalaryAssignment({
  employees,
  salaryStructures,
  assignments,
  onAssign,
  onUpdate,
  onRevoke,
  onBulkAssign,
  isLoading = false
}: EmployeeSalaryAssignmentProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<SalaryAssignment | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [structureFilter, setStructureFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [previewCalculation, setPreviewCalculation] = useState<any>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    reset,
  } = useForm<SalaryAssignmentFormData>({
    resolver: zodResolver(salaryAssignmentSchema),
    defaultValues: {
      effectiveFrom: new Date().toISOString().split('T')[0],
      componentOverrides: [],
    },
  })

  const watchedEmployeeId = watch('employeeId')
  const watchedStructureId = watch('structureId')
  const watchedCTC = watch('ctc')

  const selectedEmployee = employees.find(emp => emp.id === watchedEmployeeId)
  const selectedStructure = salaryStructures.find(struct => struct.id === watchedStructureId)

  // Get unique departments for filtering
  const departments = Array.from(new Set(employees.map(emp => emp.department.name)))
    .map(name => ({ name, id: employees.find(emp => emp.department.name === name)?.department.id || '' }))

  // Filter assignments
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = searchTerm === '' || 
      assignment.employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.employee.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.employee.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesDepartment = departmentFilter === '' ||
      assignment.employee.department.id === departmentFilter
    
    const matchesStructure = structureFilter === '' || 
      assignment.structure.id === structureFilter

    return matchesSearch && matchesDepartment && matchesStructure
  })

  // Calculate preview when CTC or structure changes
  useEffect(() => {
    if (selectedStructure && watchedCTC) {
      calculatePreview()
    }
  }, [selectedStructure, watchedCTC])

  const calculatePreview = async () => {
    if (!selectedStructure || !watchedCTC) return

    try {
      const response = await fetch('/api/payroll/calculate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structureId: selectedStructure.id,
          ctc: watchedCTC,
        }),
      })

      if (response.ok) {
        const preview = await response.json()
        setPreviewCalculation(preview)
      }
    } catch (error) {
      console.error('Error calculating preview:', error)
    }
  }

  const handleFormSubmit = async (data: SalaryAssignmentFormData) => {
    try {
      setError(null)
      
      // Validate CTC against grade limits if applicable
      if (selectedStructure?.grade) {
        const annualCTC = data.ctc
        if (annualCTC < selectedStructure.grade.minSalary || annualCTC > selectedStructure.grade.maxSalary) {
          setError(`CTC must be between ₹${selectedStructure.grade.minSalary.toLocaleString()} and ₹${selectedStructure.grade.maxSalary.toLocaleString()} for this grade`)
          return
        }
      }

      if (editingAssignment) {
        await onUpdate(editingAssignment.id, data)
      } else {
        await onAssign(data)
      }
      
      setShowAssignDialog(false)
      setEditingAssignment(null)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleEdit = (assignment: SalaryAssignment) => {
    setEditingAssignment(assignment)
    setValue('employeeId', assignment.employee.id)
    setValue('structureId', assignment.structure.id)
    setValue('ctc', assignment.ctc)
    setValue('effectiveFrom', assignment.effectiveFrom.split('T')[0])
    setValue('effectiveTo', assignment.effectiveTo?.split('T')[0] || '')
    setValue('revisionReason', assignment.revisionReason || '')
    setValue('notes', '')
    setShowAssignDialog(true)
  }

  const handleRevoke = async (assignment: SalaryAssignment) => {
    const reason = prompt('Please provide a reason for revoking this salary assignment:')
    if (reason) {
      try {
        await onRevoke(assignment.id, reason)
      } catch (error) {
        setError('Failed to revoke salary assignment')
      }
    }
  }

  const resetForm = () => {
    reset()
    setEditingAssignment(null)
    setError(null)
    setPreviewCalculation(null)
  }

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.employee.firstName} {row.original.employee.lastName}</span>
          <span className="text-sm text-gray-500">{row.original.employee.employeeCode}</span>
          <span className="text-xs text-gray-400">{row.original.employee.designation}</span>
        </div>
      ),
    },
    {
      key: 'structure',
      header: 'Salary Structure',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.structure.name}</span>
          <span className="text-sm text-gray-500">{row.original.structure.code}</span>
        </div>
      ),
    },
    {
      key: 'ctc',
      header: 'CTC',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">₹{row.original.ctc.toLocaleString()}</span>
          <span className="text-xs text-gray-500">Annual</span>
        </div>
      ),
    },
    {
      key: 'effective',
      header: 'Effective Period',
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="text-sm">From: {new Date(row.original.effectiveFrom).toLocaleDateString()}</span>
          {row.original.effectiveTo && (
            <span className="text-sm">To: {new Date(row.original.effectiveTo).toLocaleDateString()}</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: ({ row }: any) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(row.original)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => calculatePreview()}
          >
            <Calculator className="h-4 w-4" />
          </Button>
          {row.original.isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => handleRevoke(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" />
            Employee Salary Assignment
          </h1>
          <p className="text-muted-foreground">
            Assign and manage salary structures for employees
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Dialog open={showAssignDialog} onOpenChange={(open) => {
            setShowAssignDialog(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Assign Salary
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingAssignment ? 'Update Salary Assignment' : 'Assign Salary Structure'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Employee and Structure Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">Employee *</Label>
                    <EmployeeSelect
                      employees={employees}
                      value={watchedEmployeeId}
                      onValueChange={(value) => setValue('employeeId', value)}
                      disabled={isLoading || isSubmitting || !!editingAssignment}
                      placeholder="Select employee"
                      showDepartment={true}
                      showEmail={false}
                    />
                    {errors.employeeId && (
                      <p className="text-sm text-red-600">{errors.employeeId.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="structureId">Salary Structure *</Label>
                    <Select
                      value={watchedStructureId}
                      onValueChange={(value) => setValue('structureId', value)}
                      disabled={isLoading || isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select salary structure" />
                      </SelectTrigger>
                      <SelectContent>
                        {salaryStructures.map((structure) => (
                          <SelectItem key={structure.id} value={structure.id}>
                            <div className="flex flex-col">
                              <span>{structure.name}</span>
                              <span className="text-xs text-gray-500">
                                {structure.code}
                                {structure.grade && (
                                  <span> • ₹{structure.grade.minSalary.toLocaleString()} - ₹{structure.grade.maxSalary.toLocaleString()}</span>
                                )}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.structureId && (
                      <p className="text-sm text-red-600">{errors.structureId.message}</p>
                    )}
                  </div>
                </div>

                {/* Current Employee Info */}
                {selectedEmployee && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Current Employee Information</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700">Department:</span> {selectedEmployee.department.name}
                      </div>
                      <div>
                        <span className="text-blue-700">Designation:</span> {selectedEmployee.designation}
                      </div>
                      {selectedEmployee.currentSalary && (
                        <>
                          <div>
                            <span className="text-blue-700">Current CTC:</span> ₹{selectedEmployee.currentSalary.ctc.toLocaleString()}
                          </div>
                          <div>
                            <span className="text-blue-700">Current Structure:</span> {selectedEmployee.currentSalary.structure.name}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* CTC and Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ctc">Annual CTC *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="ctc"
                        type="number"
                        step="1000"
                        placeholder="1200000"
                        className="pl-10"
                        {...register('ctc', { valueAsNumber: true })}
                        disabled={isLoading || isSubmitting}
                      />
                    </div>
                    {selectedStructure?.grade && (
                      <p className="text-xs text-gray-500">
                        Grade range: ₹{selectedStructure.grade.minSalary.toLocaleString()} - ₹{selectedStructure.grade.maxSalary.toLocaleString()}
                      </p>
                    )}
                    {errors.ctc && (
                      <p className="text-sm text-red-600">{errors.ctc.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="effectiveFrom">Effective From *</Label>
                    <Input
                      id="effectiveFrom"
                      type="date"
                      {...register('effectiveFrom')}
                      disabled={isLoading || isSubmitting}
                    />
                    {errors.effectiveFrom && (
                      <p className="text-sm text-red-600">{errors.effectiveFrom.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="effectiveTo">Effective To</Label>
                    <Input
                      id="effectiveTo"
                      type="date"
                      {...register('effectiveTo')}
                      disabled={isLoading || isSubmitting}
                    />
                  </div>
                </div>

                {/* Revision Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="revisionReason">Revision Reason</Label>
                    <Select
                      value={watch('revisionReason')}
                      onValueChange={(value) => setValue('revisionReason', value)}
                      disabled={isLoading || isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {revisionReasonOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="approvedBy">Approved By</Label>
                    <Input
                      id="approvedBy"
                      {...register('approvedBy')}
                      placeholder="Approver name or ID"
                      disabled={isLoading || isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Additional notes or comments"
                    disabled={isLoading || isSubmitting}
                    rows={3}
                  />
                </div>

                {/* Preview Calculation */}
                {previewCalculation && (
                  <div className="space-y-4">
                    <Separator />
                    <h4 className="font-medium">Salary Breakdown Preview</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="p-3">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Monthly Gross</p>
                          <p className="text-lg font-bold text-green-600">
                            ₹{Math.round(previewCalculation.grossSalary / 12).toLocaleString()}
                          </p>
                        </div>
                      </Card>
                      <Card className="p-3">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Monthly Deductions</p>
                          <p className="text-lg font-bold text-red-600">
                            ₹{Math.round(previewCalculation.totalDeductions / 12).toLocaleString()}
                          </p>
                        </div>
                      </Card>
                      <Card className="p-3">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Monthly Net</p>
                          <p className="text-lg font-bold text-blue-600">
                            ₹{Math.round(previewCalculation.netSalary / 12).toLocaleString()}
                          </p>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAssignDialog(false)}
                    disabled={isLoading || isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingAssignment ? 'Update Assignment' : 'Assign Salary'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <DepartmentSelect
              departments={departments}
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
              placeholder="All Departments"
              className="w-48"
              showEmployeeCount={true}
              allowClear={true}
            />
            <Select value={structureFilter} onValueChange={setStructureFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Structures" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Structures</SelectItem>
                {salaryStructures.map((structure) => (
                  <SelectItem key={structure.id} value={structure.id}>
                    {structure.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Salary Assignments ({filteredAssignments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredAssignments}
            loading={isLoading}
            searchKey="employee"
            searchPlaceholder="Search assignments..."
          />
        </CardContent>
      </Card>
    </div>
  )
}
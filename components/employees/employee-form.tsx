'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, Save, User, Briefcase, DollarSign, FileText } from 'lucide-react'

const employeeFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  designation: z.string().min(1, 'Designation is required'),
  departmentId: z.string().min(1, 'Department is required'),
  joiningDate: z.string().min(1, 'Joining date is required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
  reportingTo: z.string().optional(),
  basicSalary: z.coerce.number().positive().optional(),
  ctc: z.coerce.number().positive().optional(),
  salaryGrade: z.string().optional(),
  panNumber: z.string().optional(),
  aadharNumber: z.string().optional(),
  pfNumber: z.string().optional(),
  esiNumber: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE']).optional(),
})

type EmployeeFormData = z.infer<typeof employeeFormSchema>

interface Department {
  id: string
  name: string
  code: string
}

interface Manager {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  designation: string
  department: {
    name: string
  }
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  dateOfBirth?: Date | null
  gender?: string | null
  address?: Record<string, unknown>
  designation: string
  departmentId: string
  joiningDate: Date
  employmentType: string
  reportingTo?: string | null
  basicSalary?: number | string // Prisma Decimal type
  ctc?: number | string // Prisma Decimal type
  salaryGrade?: string | null
  panNumber?: string | null
  aadharNumber?: string | null
  pfNumber?: string | null
  esiNumber?: string | null
  status: string
}

interface EmployeeFormProps {
  employee?: Employee
  departments: Department[]
  managers: Manager[]
  isEditing?: boolean
}

export function EmployeeForm({ employee, departments, managers, isEditing = false }: EmployeeFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      firstName: employee?.firstName || '',
      lastName: employee?.lastName || '',
      email: employee?.email || '',
      phone: employee?.phone || '',
      dateOfBirth: employee?.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : '',
      gender: (employee?.gender as 'MALE' | 'FEMALE' | 'OTHER') || undefined,
      address: employee?.address || {
        street: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
      },
      designation: employee?.designation || '',
      departmentId: employee?.departmentId || '',
      joiningDate: employee?.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '',
      employmentType: (employee?.employmentType as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN') || 'FULL_TIME',
      reportingTo: employee?.reportingTo || '',
      basicSalary: employee?.basicSalary ? Number(employee.basicSalary) : undefined,
      ctc: employee?.ctc ? Number(employee.ctc) : undefined,
      salaryGrade: employee?.salaryGrade || '',
      panNumber: employee?.panNumber || '',
      aadharNumber: employee?.aadharNumber || '',
      pfNumber: employee?.pfNumber || '',
      esiNumber: employee?.esiNumber || '',
      status: (employee?.status as 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | 'ON_LEAVE') || 'ACTIVE',
    },
  })

  const onSubmit = async (data: EmployeeFormData) => {
    setIsLoading(true)
    
    try {
      const url = isEditing ? `/api/employees/${employee?.id}` : '/api/employees'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save employee')
      }

      toast.success(
        isEditing ? 'Employee updated successfully' : 'Employee created successfully',
        {
          description: isEditing 
            ? 'The employee profile has been updated.'
            : `Employee code: ${result.employee.employeeCode}. Temporary password: ${result.tempPassword}`,
        }
      )

      router.push(`/dashboard/employees/${result.employee.id}`)
      router.refresh()
    } catch (error) {
      console.error('Error saving employee:', error)
      toast.error('Failed to save employee', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Basic personal details of the employee
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <Input
                    id="firstName"
                    placeholder="Enter first name"
                    {...field}
                  />
                )}
              />
              {errors.firstName && (
                <p className="text-sm font-medium text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => (
                  <Input
                    id="lastName"
                    placeholder="Enter last name"
                    {...field}
                  />
                )}
              />
              {errors.lastName && (
                <p className="text-sm font-medium text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    disabled={isEditing}
                    {...field}
                  />
                )}
              />
              {errors.email && (
                <p className="text-sm font-medium text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <Input
                    id="phone"
                    placeholder="Enter phone number"
                    {...field}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Controller
                name="dateOfBirth"
                control={control}
                render={({ field }) => (
                  <Input
                    id="dateOfBirth"
                    type="date"
                    {...field}
                  />
                )}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <Separator />
          
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Address</h4>
            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <Controller
                name="address.street"
                control={control}
                render={({ field }) => (
                  <Input
                    id="street"
                    placeholder="Enter street address"
                    {...field}
                  />
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Controller
                  name="address.city"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="city"
                      placeholder="Enter city"
                      {...field}
                    />
                  )}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Controller
                  name="address.state"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="state"
                      placeholder="Enter state"
                      {...field}
                    />
                  )}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Controller
                  name="address.pincode"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="pincode"
                      placeholder="Enter pincode"
                      {...field}
                    />
                  )}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Professional Information
          </CardTitle>
          <CardDescription>
            Work-related details and organizational structure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="designation">Designation *</Label>
              <Controller
                name="designation"
                control={control}
                render={({ field }) => (
                  <Input
                    id="designation"
                    placeholder="Enter designation"
                    {...field}
                  />
                )}
              />
              {errors.designation && (
                <p className="text-sm font-medium text-destructive">
                  {errors.designation.message}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department *</Label>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.departmentId && (
                <p className="text-sm font-medium text-destructive">
                  {errors.departmentId.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="joiningDate">Joining Date *</Label>
              <Controller
                name="joiningDate"
                control={control}
                render={({ field }) => (
                  <Input
                    id="joiningDate"
                    type="date"
                    {...field}
                  />
                )}
              />
              {errors.joiningDate && (
                <p className="text-sm font-medium text-destructive">
                  {errors.joiningDate.message}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="employmentType">Employment Type</Label>
              <Controller
                name="employmentType"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_TIME">Full Time</SelectItem>
                      <SelectItem value="PART_TIME">Part Time</SelectItem>
                      <SelectItem value="CONTRACT">Contract</SelectItem>
                      <SelectItem value="INTERN">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reportingTo">Reporting Manager</Label>
              <Controller
                name="reportingTo"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reporting manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.firstName} {manager.lastName} ({manager.employeeCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                        <SelectItem value="TERMINATED">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Salary Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Salary Information
          </CardTitle>
          <CardDescription>
            Compensation and salary structure details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="basicSalary">Basic Salary</Label>
              <Controller
                name="basicSalary"
                control={control}
                render={({ field }) => (
                  <Input
                    id="basicSalary"
                    type="number"
                    placeholder="Enter basic salary"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  />
                )}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ctc">CTC (Annual)</Label>
              <Controller
                name="ctc"
                control={control}
                render={({ field }) => (
                  <Input
                    id="ctc"
                    type="number"
                    placeholder="Enter CTC"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  />
                )}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="salaryGrade">Salary Grade</Label>
              <Controller
                name="salaryGrade"
                control={control}
                render={({ field }) => (
                  <Input
                    id="salaryGrade"
                    placeholder="Enter salary grade"
                    {...field}
                  />
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Compliance Information
          </CardTitle>
          <CardDescription>
            Statutory and compliance-related details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="panNumber">PAN Number</Label>
              <Controller
                name="panNumber"
                control={control}
                render={({ field }) => (
                  <Input
                    id="panNumber"
                    placeholder="Enter PAN number"
                    {...field}
                  />
                )}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="aadharNumber">Aadhar Number</Label>
              <Controller
                name="aadharNumber"
                control={control}
                render={({ field }) => (
                  <Input
                    id="aadharNumber"
                    placeholder="Enter Aadhar number"
                    {...field}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pfNumber">PF Number</Label>
              <Controller
                name="pfNumber"
                control={control}
                render={({ field }) => (
                  <Input
                    id="pfNumber"
                    placeholder="Enter PF number"
                    {...field}
                  />
                )}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="esiNumber">ESI Number</Label>
              <Controller
                name="esiNumber"
                control={control}
                render={({ field }) => (
                  <Input
                    id="esiNumber"
                    placeholder="Enter ESI number"
                    {...field}
                  />
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          {isEditing ? 'Update Employee' : 'Create Employee'}
        </Button>
      </div>
    </form>
  )
}
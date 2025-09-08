"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserRole } from "@prisma/client"
import { AlertCircle, User, Mail, Lock, Building, Calendar, Phone } from "lucide-react"

interface Department {
  id: string
  name: string
  code: string
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
}

export default function RegisterForm() {
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
    role: UserRole.EMPLOYEE,
    employeeData: {
      employeeCode: "",
      firstName: "",
      lastName: "",
      phone: "",
      dateOfBirth: "",
      gender: "",
      designation: "",
      departmentId: "",
      joiningDate: "",
      employmentType: "FULL_TIME",
      reportingTo: "",
      basicSalary: "",
      ctc: "",
      salaryGrade: "",
      panNumber: "",
      aadharNumber: "",
      pfNumber: "",
      esiNumber: ""
    }
  })

  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()

  useEffect(() => {
    // Load departments and managers
    loadDepartments()
    loadManagers()
  }, [])

  const loadDepartments = async () => {
    try {
      const response = await fetch('/api/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments || [])
      }
    } catch (error) {
      console.error('Failed to load departments:', error)
    }
  }

  const loadManagers = async () => {
    try {
      const response = await fetch('/api/employees?role=manager')
      if (response.ok) {
        const data = await response.json()
        setManagers(data.employees || [])
      }
    } catch (error) {
      console.error('Failed to load managers:', error)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('employeeData.')) {
      const employeeField = field.replace('employeeData.', '')
      setFormData(prev => ({
        ...prev,
        employeeData: {
          ...prev.employeeData,
          [employeeField]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const validateForm = () => {
    if (!formData.email || !formData.name || !formData.password) {
      setError("Please fill in all required fields")
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return false
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long")
      return false
    }

    if (!formData.employeeData.employeeCode || !formData.employeeData.firstName || 
        !formData.employeeData.lastName || !formData.employeeData.designation || 
        !formData.employeeData.departmentId || !formData.employeeData.joiningDate) {
      setError("Please fill in all required employee fields")
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          employeeData: {
            ...formData.employeeData,
            basicSalary: formData.employeeData.basicSalary ? parseFloat(formData.employeeData.basicSalary) : undefined,
            ctc: formData.employeeData.ctc ? parseFloat(formData.employeeData.ctc) : undefined
          }
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess("User registered successfully!")
        // Reset form
        setFormData({
          email: "",
          name: "",
          password: "",
          confirmPassword: "",
          role: UserRole.EMPLOYEE,
          employeeData: {
            employeeCode: "",
            firstName: "",
            lastName: "",
            phone: "",
            dateOfBirth: "",
            gender: "",
            designation: "",
            departmentId: "",
            joiningDate: "",
            employmentType: "FULL_TIME",
            reportingTo: "",
            basicSalary: "",
            ctc: "",
            salaryGrade: "",
            panNumber: "",
            aadharNumber: "",
            pfNumber: "",
            esiNumber: ""
          }
        })
      } else {
        setError(data.error || "Registration failed")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Register New User
          </CardTitle>
          <CardDescription>
            Create a new user account with employee details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {success}
              </div>
            )}

            {/* User Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      placeholder="user@company.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name *</label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="password"
                      placeholder="Minimum 8 characters"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="password"
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => handleInputChange('role', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UserRole.EMPLOYEE}>Employee</SelectItem>
                      <SelectItem value={UserRole.MANAGER}>Manager</SelectItem>
                      <SelectItem value={UserRole.HR}>HR</SelectItem>
                      <SelectItem value={UserRole.FINANCE}>Finance</SelectItem>
                      <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Employee Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Employee Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Employee Code *</label>
                  <Input
                    type="text"
                    placeholder="EMP001"
                    value={formData.employeeData.employeeCode}
                    onChange={(e) => handleInputChange('employeeData.employeeCode', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name *</label>
                  <Input
                    type="text"
                    placeholder="John"
                    value={formData.employeeData.firstName}
                    onChange={(e) => handleInputChange('employeeData.firstName', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name *</label>
                  <Input
                    type="text"
                    placeholder="Doe"
                    value={formData.employeeData.lastName}
                    onChange={(e) => handleInputChange('employeeData.lastName', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="tel"
                      placeholder="+91-9876543210"
                      value={formData.employeeData.phone}
                      onChange={(e) => handleInputChange('employeeData.phone', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date of Birth</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="date"
                      value={formData.employeeData.dateOfBirth}
                      onChange={(e) => handleInputChange('employeeData.dateOfBirth', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Gender</label>
                  <Select
                    value={formData.employeeData.gender}
                    onValueChange={(value) => handleInputChange('employeeData.gender', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Designation *</label>
                  <Input
                    type="text"
                    placeholder="Software Engineer"
                    value={formData.employeeData.designation}
                    onChange={(e) => handleInputChange('employeeData.designation', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Department *</label>
                  <Select
                    value={formData.employeeData.departmentId}
                    onValueChange={(value) => handleInputChange('employeeData.departmentId', value)}
                  >
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
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Joining Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="date"
                      value={formData.employeeData.joiningDate}
                      onChange={(e) => handleInputChange('employeeData.joiningDate', e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Employment Type</label>
                  <Select
                    value={formData.employeeData.employmentType}
                    onValueChange={(value) => handleInputChange('employeeData.employmentType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_TIME">Full Time</SelectItem>
                      <SelectItem value="PART_TIME">Part Time</SelectItem>
                      <SelectItem value="CONTRACT">Contract</SelectItem>
                      <SelectItem value="INTERN">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Reporting Manager</label>
                  <Select
                    value={formData.employeeData.reportingTo}
                    onValueChange={(value) => handleInputChange('employeeData.reportingTo', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.firstName} {manager.lastName} ({manager.employeeCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Registering..." : "Register User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
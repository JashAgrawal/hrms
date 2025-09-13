'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Building,
  Briefcase,
  DollarSign,
  FileText,
  Clock,
  Users,
  Activity,
  Download
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { EmployeeSiteAssignment } from './employee-site-assignment'
import { LocationAssignmentForm } from './location-assignment-form'
import { useSession } from 'next-auth/react'

interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  dateOfBirth?: Date | null
  gender?: string | null
  address?: Record<string, unknown>
  designation: string
  joiningDate: Date
  employmentType: string
  employeeType: string
  status: string
  basicSalary?: number | string // Prisma Decimal type
  ctc?: number | string // Prisma Decimal type
  salaryGrade?: string | null
  panNumber?: string | null
  aadharNumber?: string | null
  pfNumber?: string | null
  esiNumber?: string | null
  user: {
    id: string
    role: string
    isActive: boolean
    lastLoginAt?: Date | null
  }
  department: {
    id: string
    name: string
    code: string
  }
  manager?: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    designation: string
  } | null
  subordinates: Array<{
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    designation: string
    status: string
  }>
  attendanceRecords: Array<{
    id: string
    date: Date
    checkIn?: Date | null
    checkOut?: Date | null
    status: string
    workHours?: number | string // Prisma Decimal type
  }>
  leaveRequests: Array<{
    id: string
    startDate: Date
    endDate: Date
    days: number | string // Prisma Decimal type
    status: string
    reason: string
    policy: {
      name: string
      type: string // Prisma enum type
    }
  }>
  documents: Array<{
    id: string
    title: string
    category: string
    fileName: string
    fileSize?: number | null
    createdAt: Date
  }>
}

interface EmployeeProfileProps {
  employee: Employee
}

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  INACTIVE: 'bg-gray-100 text-gray-800 border-gray-200',
  ON_LEAVE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  TERMINATED: 'bg-red-100 text-red-800 border-red-200',
}

const attendanceStatusColors = {
  PRESENT: 'bg-green-100 text-green-800',
  ABSENT: 'bg-red-100 text-red-800',
  LATE: 'bg-yellow-100 text-yellow-800',
  HALF_DAY: 'bg-orange-100 text-orange-800',
  WORK_FROM_HOME: 'bg-blue-100 text-blue-800',
  ON_LEAVE: 'bg-purple-100 text-purple-800',
  HOLIDAY: 'bg-gray-100 text-gray-800',
}

const leaveStatusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

export function EmployeeProfile({ employee }: EmployeeProfileProps) {
  const { data: session } = useSession()

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  // Check if current user can manage locations
  const canManageLocations = session?.user && ['ADMIN', 'HR'].includes(session.user.role)

  const formatAddress = (address?: Record<string, unknown>) => {
    if (!address) return 'Not provided'
    
    const parts = [
      address.street,
      address.city,
      address.state,
      address.pincode,
      address.country
    ].filter(Boolean)
    
    return parts.length > 0 ? parts.join(', ') : 'Not provided'
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src="" alt={`${employee.firstName} ${employee.lastName}`} />
                <AvatarFallback className="text-lg">
                  {getInitials(employee.firstName, employee.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div>
                  <h2 className="text-2xl font-bold">
                    {employee.firstName} {employee.lastName}
                  </h2>
                  <p className="text-muted-foreground">
                    {employee.employeeCode} • {employee.designation}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant="outline" 
                    className={statusColors[employee.status as keyof typeof statusColors]}
                  >
                    {employee.status.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline">
                    {employee.employmentType.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline">
                    {employee.user.role}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.email}</span>
                </div>
                {employee.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{employee.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.department.name}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Joined {formatDate(employee.joiningDate)}</span>
                </div>
                {employee.manager && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Reports to {employee.manager.firstName} {employee.manager.lastName}</span>
                  </div>
                )}
                {employee.user.lastLoginAt && (
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span>Last login {formatDate(employee.user.lastLoginAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className={`grid w-full ${employee.employeeType === 'FIELD_EMPLOYEE' ? (canManageLocations ? 'grid-cols-8' : 'grid-cols-7') : (canManageLocations ? 'grid-cols-7' : 'grid-cols-6')}`}>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="professional">Professional</TabsTrigger>
          <TabsTrigger value="salary">Salary</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          {canManageLocations && (
            <TabsTrigger value="locations">Locations</TabsTrigger>
          )}
          {employee.employeeType === 'FIELD_EMPLOYEE' && (
            <TabsTrigger value="sites">Sites</TabsTrigger>
          )}
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Personal Information */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <p className="text-sm">{employee.firstName} {employee.lastName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-sm">{employee.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-sm">{employee.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                    <p className="text-sm">
                      {employee.dateOfBirth ? formatDate(employee.dateOfBirth) : 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Gender</label>
                    <p className="text-sm">{employee.gender || 'Not provided'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <p className="text-sm">{formatAddress(employee.address)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Professional Information */}
        <TabsContent value="professional">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Professional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Employee Code</label>
                    <p className="text-sm font-mono">{employee.employeeCode}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Designation</label>
                    <p className="text-sm">{employee.designation}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Department</label>
                    <p className="text-sm">{employee.department.name} ({employee.department.code})</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Employment Type</label>
                    <p className="text-sm">{employee.employmentType.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <Badge 
                      variant="outline" 
                      className={statusColors[employee.status as keyof typeof statusColors]}
                    >
                      {employee.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Joining Date</label>
                    <p className="text-sm">{formatDate(employee.joiningDate)}</p>
                  </div>
                  {employee.manager && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Reporting Manager</label>
                      <p className="text-sm">
                        {employee.manager.firstName} {employee.manager.lastName} ({employee.manager.employeeCode})
                      </p>
                      <p className="text-xs text-muted-foreground">{employee.manager.designation}</p>
                    </div>
                  )}
                  {employee.subordinates.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Team Members</label>
                      <div className="space-y-1">
                        {employee.subordinates.map((subordinate) => (
                          <p key={subordinate.id} className="text-sm">
                            {subordinate.firstName} {subordinate.lastName} ({subordinate.employeeCode})
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Information */}
        <TabsContent value="salary">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Salary Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Basic Salary</label>
                    <p className="text-sm">
                      {employee.basicSalary ? formatCurrency(Number(employee.basicSalary)) : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">CTC (Annual)</label>
                    <p className="text-sm">
                      {employee.ctc ? formatCurrency(Number(employee.ctc)) : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Salary Grade</label>
                    <p className="text-sm">{employee.salaryGrade || 'Not set'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">PAN Number</label>
                    <p className="text-sm font-mono">{employee.panNumber || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">PF Number</label>
                    <p className="text-sm font-mono">{employee.pfNumber || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">ESI Number</label>
                    <p className="text-sm font-mono">{employee.esiNumber || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Records */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Attendance
              </CardTitle>
              <CardDescription>
                Last 10 attendance records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {employee.attendanceRecords.length > 0 ? (
                <div className="space-y-3">
                  {employee.attendanceRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{formatDate(record.date)}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {record.checkIn && (
                              <span>In: {new Date(record.checkIn).toLocaleTimeString()}</span>
                            )}
                            {record.checkOut && (
                              <span>Out: {new Date(record.checkOut).toLocaleTimeString()}</span>
                            )}
                            {record.workHours && (
                              <span>({record.workHours}h)</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge 
                        variant="outline"
                        className={attendanceStatusColors[record.status as keyof typeof attendanceStatusColors]}
                      >
                        {record.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No attendance records found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Requests */}
        <TabsContent value="leave">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Leave Requests
              </CardTitle>
              <CardDescription>
                Last 10 leave requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {employee.leaveRequests.length > 0 ? (
                <div className="space-y-3">
                  {employee.leaveRequests.map((leave) => (
                    <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{leave.policy.name}</p>
                          <Badge variant="outline">
                            {leave.days} day{leave.days !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                        </p>
                        <p className="text-sm text-muted-foreground">{leave.reason}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={leaveStatusColors[leave.status as keyof typeof leaveStatusColors]}
                      >
                        {leave.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No leave requests found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location Assignment (HR/Admin Only) */}
        {canManageLocations && (
          <TabsContent value="locations">
            <LocationAssignmentForm
              employeeId={employee.id}
              employeeName={`${employee.firstName} ${employee.lastName}`}
            />
          </TabsContent>
        )}

        {/* Sites (Field Employees Only) */}
        {employee.employeeType === 'FIELD_EMPLOYEE' && (
          <TabsContent value="sites">
            <EmployeeSiteAssignment employee={{
              id: employee.id,
              firstName: employee.firstName,
              lastName: employee.lastName,
              employeeCode: employee.employeeCode,
              employeeType: employee.employeeType,
            }} />
          </TabsContent>
        )}

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents
              </CardTitle>
              <CardDescription>
                Employee documents and files
              </CardDescription>
            </CardHeader>
            <CardContent>
              {employee.documents.length > 0 ? (
                <div className="space-y-3">
                  {employee.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{doc.category.replace('_', ' ')}</span>
                            <span>•</span>
                            <span>{formatFileSize(doc.fileSize || 0)}</span>
                            <span>•</span>
                            <span>{formatDate(doc.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No documents found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
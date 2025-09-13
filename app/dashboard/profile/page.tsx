'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Building2, 
  Shield,
  Edit,
  Save,
  Camera,
  UserCheck
} from 'lucide-react'

interface ProfileData {
  user: {
    id: string
    email: string
    name: string
    image?: string
    role: string
    isActive: boolean
    lastLoginAt: string
    createdAt: string
  }
  employee: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string
    dateOfBirth?: string
    gender?: string
    address?: any
    designation: string
    department: {
      id: string
      name: string
      code: string
    }
    joiningDate: string
    employmentType: string
    status: string
    manager?: {
      id: string
      firstName: string
      lastName: string
      employeeCode: string
    }
    basicSalary?: number
    ctc?: number
    salaryGrade?: string
  } | null
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    dateOfBirth: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India'
    },
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      email: ''
    }
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        
        // Initialize form data
        if (data.profile.employee) {
          setFormData({
            name: data.profile.user.name || '',
            phone: data.profile.employee.phone || '',
            dateOfBirth: data.profile.employee.dateOfBirth ? 
              new Date(data.profile.employee.dateOfBirth).toISOString().split('T')[0] : '',
            address: data.profile.employee.address || {
              street: '',
              city: '',
              state: '',
              zipCode: '',
              country: 'India'
            },
            emergencyContact: {
              name: '',
              relationship: '',
              phone: '',
              email: ''
            }
          })
        }
      } else {
        throw new Error('Failed to fetch profile')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      toast({
        title: 'Error',
        description: 'Failed to load profile data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Profile updated successfully',
        })
        setEditing(false)
        fetchProfile() // Refresh profile data
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const getInitials = (firstName?: string, lastName?: string, name?: string) => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    }
    if (name) {
      const parts = name.split(' ')
      return parts.length > 1 
        ? `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
        : name.charAt(0).toUpperCase()
    }
    return 'U'
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800'
      case 'HR': return 'bg-blue-100 text-blue-800'
      case 'MANAGER': return 'bg-green-100 text-green-800'
      case 'FINANCE': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'INACTIVE': return 'bg-gray-100 text-gray-800'
      case 'ON_LEAVE': return 'bg-yellow-100 text-yellow-800'
      case 'TERMINATED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <Card>
          <CardHeader className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </CardHeader>
          <CardContent className="animate-pulse">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal information and preferences
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-muted-foreground">Failed to load profile data</p>
              <Button onClick={fetchProfile} className="mt-4">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal information and preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.user.image} />
                <AvatarFallback className="text-lg">
                  {getInitials(
                    profile.employee?.firstName, 
                    profile.employee?.lastName, 
                    profile.user.name
                  )}
                </AvatarFallback>
              </Avatar>
              {editing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">
                  {profile.employee 
                    ? `${profile.employee.firstName} ${profile.employee.lastName}`
                    : profile.user.name
                  }
                </h2>
                <Badge className={getRoleColor(profile.user.role)}>
                  {profile.user.role}
                </Badge>
                {profile.employee && (
                  <Badge className={getStatusColor(profile.employee.status)}>
                    {profile.employee.status}
                  </Badge>
                )}
              </div>
              
              {profile.employee && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    <span>{profile.employee.employeeCode} • {profile.employee.designation}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{profile.employee.department.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {new Date(profile.employee.joiningDate).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Tabs */}
      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList>
          <TabsTrigger value="personal">Personal Information</TabsTrigger>
          <TabsTrigger value="contact">Contact Details</TabsTrigger>
          <TabsTrigger value="employment">Employment Details</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Your personal details and basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  {editing ? (
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {profile.user.name || 'Not provided'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <p className="text-sm p-2 bg-muted rounded">
                    {profile.user.email}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  {editing ? (
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {profile.employee?.dateOfBirth 
                        ? new Date(profile.employee.dateOfBirth).toLocaleDateString()
                        : 'Not provided'
                      }
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <p className="text-sm p-2 bg-muted rounded">
                    {profile.employee?.gender || 'Not provided'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
              <CardDescription>
                Your contact information and address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  {editing ? (
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {profile.employee?.phone || 'Not provided'}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address</Label>
                    {editing ? (
                      <Input
                        id="street"
                        value={formData.address.street}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          address: { ...formData.address, street: e.target.value }
                        })}
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded">
                        {profile.employee?.address?.street || 'Not provided'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    {editing ? (
                      <Input
                        id="city"
                        value={formData.address.city}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          address: { ...formData.address, city: e.target.value }
                        })}
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded">
                        {profile.employee?.address?.city || 'Not provided'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    {editing ? (
                      <Input
                        id="state"
                        value={formData.address.state}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          address: { ...formData.address, state: e.target.value }
                        })}
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded">
                        {profile.employee?.address?.state || 'Not provided'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    {editing ? (
                      <Input
                        id="zipCode"
                        value={formData.address.zipCode}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          address: { ...formData.address, zipCode: e.target.value }
                        })}
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded">
                        {profile.employee?.address?.zipCode || 'Not provided'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment">
          {profile.employee ? (
            <Card>
              <CardHeader>
                <CardTitle>Employment Details</CardTitle>
                <CardDescription>
                  Your employment information and work details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Employee Code</Label>
                    <p className="text-sm p-2 bg-muted rounded">
                      {profile.employee.employeeCode}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <p className="text-sm p-2 bg-muted rounded">
                      {profile.employee.designation}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Department</Label>
                    <p className="text-sm p-2 bg-muted rounded">
                      {profile.employee.department.name}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Employment Type</Label>
                    <p className="text-sm p-2 bg-muted rounded">
                      {profile.employee.employmentType.replace('_', ' ')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Joining Date</Label>
                    <p className="text-sm p-2 bg-muted rounded">
                      {new Date(profile.employee.joiningDate).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Badge className={getStatusColor(profile.employee.status)}>
                      {profile.employee.status}
                    </Badge>
                  </div>

                  {profile.employee.manager && (
                    <div className="space-y-2">
                      <Label>Reporting Manager</Label>
                      <p className="text-sm p-2 bg-muted rounded">
                        {profile.employee.manager.firstName} {profile.employee.manager.lastName} 
                        ({profile.employee.manager.employeeCode})
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-muted-foreground">No employment details available</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Account Status</Label>
                  <Badge className={profile.user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {profile.user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label>Last Login</Label>
                  <p className="text-sm p-2 bg-muted rounded">
                    {profile.user.lastLoginAt 
                      ? new Date(profile.user.lastLoginAt).toLocaleString()
                      : 'Never'
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Account Created</Label>
                  <p className="text-sm p-2 bg-muted rounded">
                    {new Date(profile.user.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button variant="outline">
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

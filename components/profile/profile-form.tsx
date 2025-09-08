"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, User, Mail, Phone, Calendar, MapPin, Save } from "lucide-react"

interface ProfileData {
  user: {
    id: string
    email: string
    name: string
    role: string
    isActive: boolean
    lastLoginAt: string | null
    createdAt: string
  }
  employee: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    dateOfBirth: string | null
    gender: string | null
    address: any
    designation: string
    department: {
      id: string
      name: string
      code: string
    }
    joiningDate: string
    employmentType: string
    status: string
    manager: {
      id: string
      firstName: string
      lastName: string
      employeeCode: string
    } | null
    basicSalary: number | null
    ctc: number | null
    salaryGrade: string | null
  } | null
}

export default function ProfileForm() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    dateOfBirth: "",
    address: {
      street: "",
      city: "",
      state: "",
      country: "",
      zipCode: ""
    },
    emergencyContact: {
      name: "",
      relationship: "",
      phone: "",
      email: ""
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        
        // Populate form with existing data
        setFormData({
          name: data.profile.user.name || "",
          phone: data.profile.employee?.phone || "",
          dateOfBirth: data.profile.employee?.dateOfBirth ? 
            new Date(data.profile.employee.dateOfBirth).toISOString().split('T')[0] : "",
          address: data.profile.employee?.address || {
            street: "",
            city: "",
            state: "",
            country: "",
            zipCode: ""
          },
          emergencyContact: {
            name: "",
            relationship: "",
            phone: "",
            email: ""
          }
        })
      } else {
        setError("Failed to load profile")
      }
    } catch (error) {
      setError("An error occurred while loading profile")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.replace('address.', '')
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }))
    } else if (field.startsWith('emergencyContact.')) {
      const contactField = field.replace('emergencyContact.', '')
      setFormData(prev => ({
        ...prev,
        emergencyContact: {
          ...prev.emergencyContact,
          [contactField]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess("Profile updated successfully!")
        // Reload profile to get updated data
        await loadProfile()
      } else {
        setError(data.error || "Failed to update profile")
      }
    } catch (error) {
      setError("An error occurred while updating profile")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Profile not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Profile Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Overview
          </CardTitle>
          <CardDescription>
            Your account and employee information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Employee Code</p>
              <p className="text-sm">{profile.employee?.employeeCode || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="text-sm">{profile.user.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Role</p>
              <p className="text-sm capitalize">{profile.user.role.toLowerCase()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Department</p>
              <p className="text-sm">{profile.employee?.department?.name || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Designation</p>
              <p className="text-sm">{profile.employee?.designation || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Joining Date</p>
              <p className="text-sm">
                {profile.employee?.joiningDate ? 
                  new Date(profile.employee.joiningDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            {profile.employee?.manager && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Reporting Manager</p>
                <p className="text-sm">
                  {profile.employee.manager.firstName} {profile.employee.manager.lastName}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editable Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
          <CardDescription>
            Update your personal information
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

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+91-9876543210"
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
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Street Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      value={formData.address.street}
                      onChange={(e) => handleInputChange('address.street', e.target.value)}
                      placeholder="Street address"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">City</label>
                  <Input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    placeholder="City"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <Input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    placeholder="State"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Country</label>
                  <Input
                    type="text"
                    value={formData.address.country}
                    onChange={(e) => handleInputChange('address.country', e.target.value)}
                    placeholder="Country"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">ZIP Code</label>
                  <Input
                    type="text"
                    value={formData.address.zipCode}
                    onChange={(e) => handleInputChange('address.zipCode', e.target.value)}
                    placeholder="ZIP Code"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contact Name</label>
                  <Input
                    type="text"
                    value={formData.emergencyContact.name}
                    onChange={(e) => handleInputChange('emergencyContact.name', e.target.value)}
                    placeholder="Emergency contact name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Relationship</label>
                  <Input
                    type="text"
                    value={formData.emergencyContact.relationship}
                    onChange={(e) => handleInputChange('emergencyContact.relationship', e.target.value)}
                    placeholder="Relationship (e.g., Spouse, Parent)"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Contact Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="tel"
                      value={formData.emergencyContact.phone}
                      onChange={(e) => handleInputChange('emergencyContact.phone', e.target.value)}
                      placeholder="+91-9876543210"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Contact Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      value={formData.emergencyContact.email}
                      onChange={(e) => handleInputChange('emergencyContact.email', e.target.value)}
                      placeholder="emergency@example.com"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
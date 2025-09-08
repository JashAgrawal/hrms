"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Lock, Eye, EyeOff } from "lucide-react"

export default function ChangePasswordForm() {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear errors when user starts typing
    if (error) setError("")
    if (success) setSuccess("")
  }

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const validateForm = () => {
    if (!formData.currentPassword) {
      setError("Current password is required")
      return false
    }

    if (!formData.newPassword) {
      setError("New password is required")
      return false
    }

    if (formData.newPassword.length < 8) {
      setError("New password must be at least 8 characters long")
      return false
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match")
      return false
    }

    if (formData.currentPassword === formData.newPassword) {
      setError("New password must be different from current password")
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
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess("Password changed successfully!")
        // Clear form
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        })
      } else {
        setError(data.error || "Failed to change password")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, label: "", color: "" }
    
    let score = 0
    if (password.length >= 8) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 2) return { strength: score, label: "Weak", color: "bg-red-500" }
    if (score <= 3) return { strength: score, label: "Fair", color: "bg-yellow-500" }
    if (score <= 4) return { strength: score, label: "Good", color: "bg-blue-500" }
    return { strength: score, label: "Strong", color: "bg-green-500" }
  }

  const passwordStrength = getPasswordStrength(formData.newPassword)

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password for better security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Current Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type={showPasswords.current ? "text" : "password"}
                  value={formData.currentPassword}
                  onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                  placeholder="Enter current password"
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type={showPasswords.new ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => handleInputChange('newPassword', e.target.value)}
                  placeholder="Enter new password"
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.newPassword && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>Password strength:</span>
                    <span className={`font-medium ${
                      passwordStrength.label === 'Weak' ? 'text-red-600' :
                      passwordStrength.label === 'Fair' ? 'text-yellow-600' :
                      passwordStrength.label === 'Good' ? 'text-blue-600' :
                      'text-green-600'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-500">
                Password should be at least 8 characters with a mix of letters, numbers, and symbols
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type={showPasswords.confirm ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm new password"
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <div className="text-xs">
                  {formData.newPassword === formData.confirmPassword ? (
                    <span className="text-green-600">✓ Passwords match</span>
                  ) : (
                    <span className="text-red-600">✗ Passwords do not match</span>
                  )}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Changing Password..." : "Change Password"}
            </Button>
          </form>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Security Tips:</p>
              <ul className="text-xs space-y-1">
                <li>• Use a unique password for this account</li>
                <li>• Include uppercase, lowercase, numbers, and symbols</li>
                <li>• Avoid using personal information</li>
                <li>• Consider using a password manager</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
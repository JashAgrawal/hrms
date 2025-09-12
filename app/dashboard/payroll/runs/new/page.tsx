'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Calendar, Users, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface Department {
  id: string
  name: string
}

export default function NewPayrollRunPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    period: '',
    startDate: '',
    endDate: '',
    description: '',
    departmentIds: [] as string[]
  })

  // Redirect if not authenticated or doesn't have permission
  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments || [])
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [])

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create payroll run')
      }

      const result = await response.json()
      router.push(`/dashboard/payroll/runs/${result.payrollRun.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/payroll/runs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Payroll Runs
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create New Payroll Run</h1>
            <p className="text-gray-600">Set up a new payroll processing period</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span>Payroll Run Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="period">Pay Period (YYYY-MM)</Label>
                <Input
                  id="period"
                  type="text"
                  placeholder="2024-01"
                  value={formData.period}
                  onChange={(e) => handleInputChange('period', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  type="text"
                  placeholder="January 2024 Payroll"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Period Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Period End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this payroll run..."
                rows={3}
              />
            </div>

            {/* Department Selection */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <Label className="text-base font-medium">Departments to Include</Label>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {departments.map((dept) => (
                  <div key={dept.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`dept-${dept.id}`}
                      className="rounded border-gray-300"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            departmentIds: [...prev.departmentIds, dept.id]
                          }))
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            departmentIds: prev.departmentIds.filter(id => id !== dept.id)
                          }))
                        }
                      }}
                    />
                    <Label htmlFor={`dept-${dept.id}`} className="text-sm">
                      {dept.name}
                    </Label>
                  </div>
                ))}
              </div>
              
              {departments.length === 0 && (
                <p className="text-sm text-gray-500">No departments found</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Link href="/dashboard/payroll/runs">
                <Button variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </Link>
              <Button 
                type="submit" 
                disabled={isLoading || !formData.period || !formData.startDate || !formData.endDate}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? 'Creating...' : 'Create Payroll Run'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { SalaryGradeList } from '@/components/payroll/salary-grade-list'
import { SalaryGradeForm } from '@/components/payroll/salary-grade-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface SalaryGrade {
  id: string
  name: string
  code: string
  description?: string
  minSalary: number
  maxSalary: number
  currency: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: {
    salaryStructures: number
  }
}

type SalaryGradeFormData = {
  name: string
  code: string
  description?: string
  minSalary: number
  maxSalary: number
  currency: string
}

export default function SalaryGradesPage() {
  const { data: session, status } = useSession()
  const [grades, setGrades] = useState<SalaryGrade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingGrade, setEditingGrade] = useState<SalaryGrade | null>(null)

  // Redirect if not authenticated or doesn't have permission
  useEffect(() => {
    fetchGrades()
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

  const fetchGrades = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/payroll/salary-grades')
      if (response.ok) {
        const data = await response.json()
        setGrades(data)
      } else {
        console.error('Failed to fetch salary grades')
      }
    } catch (error) {
      console.error('Error fetching salary grades:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingGrade(null)
    setShowForm(true)
  }

  const handleEdit = (grade: SalaryGrade) => {
    setEditingGrade(grade)
    setShowForm(true)
  }

  const handleSubmit = async (data: SalaryGradeFormData) => {
    try {
      const url = editingGrade 
        ? `/api/payroll/salary-grades/${editingGrade.id}`
        : '/api/payroll/salary-grades'
      
      const method = editingGrade ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        await fetchGrades()
        setShowForm(false)
        setEditingGrade(null)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save salary grade')
      }
    } catch (error) {
      throw error // Re-throw to be handled by the form
    }
  }

  const handleDelete = async (gradeId: string) => {
    try {
      const response = await fetch(`/api/payroll/salary-grades/${gradeId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchGrades()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete salary grade')
      }
    } catch (error) {
      console.error('Error deleting salary grade:', error)
      throw error
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingGrade(null)
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={handleCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Salary Grades
          </Button>
        </div>

        <div className="flex justify-center">
          <SalaryGradeForm
            initialData={editingGrade ? {
              name: editingGrade.name,
              code: editingGrade.code,
              description: editingGrade.description,
              minSalary: editingGrade.minSalary,
              maxSalary: editingGrade.maxSalary,
              currency: editingGrade.currency,
            } : undefined}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/dashboard/payroll">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Payroll
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-4">Salary Grades</h1>
          <p className="text-gray-600">
            Define salary bands and grade structures for your organization
          </p>
        </div>
      </div>

      {/* Salary Grades List */}
      <SalaryGradeList
        grades={grades}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreate={handleCreate}
        isLoading={isLoading}
      />
    </div>
  )
}
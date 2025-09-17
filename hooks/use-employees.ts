import { useState, useEffect, useCallback } from "react"
export interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  department?: {
    name: string
  } | null
  designation?: string
  status: "ACTIVE" | "INACTIVE" | "TERMINATED"
}

interface UseEmployeesOptions {
  includeInactive?: boolean
  department?: string
  limit?: number
}

interface UseEmployeesReturn {
  employees: Employee[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useEmployees(options: UseEmployeesOptions = {}): UseEmployeesReturn {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Extract options to avoid dependency issues
  const { includeInactive, department, limit } = options

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (!includeInactive) params.set('status', 'ACTIVE')
      if (department) params.set('department', department)
      if (limit) params.set('limit', limit.toString())

      const response = await fetch(`/api/employees?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch employees')
      }

      const data = await response.json()
      setEmployees(data.employees || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [includeInactive, department, limit])

  useEffect(() => {
    fetchEmployees()
  }, [includeInactive, department, limit, fetchEmployees]) // Added fetchEmployees to dependencies

  return {
    employees,
    loading,
    error,
    refetch: fetchEmployees,
  }
}
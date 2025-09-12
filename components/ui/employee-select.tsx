"use client"

import * as React from "react"
import { SearchableSelect, SearchableSelectOption } from "./searchable-select"

export interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  designation: string
  email?: string
  department?: {
    name: string
  }
}

interface EmployeeSelectProps {
  employees: Employee[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  loading?: boolean
  allowClear?: boolean
  showDepartment?: boolean
  showEmail?: boolean
}

export function EmployeeSelect({
  employees,
  value,
  onValueChange,
  placeholder = "Select employee...",
  disabled = false,
  className,
  loading = false,
  allowClear = true,
  showDepartment = true,
  showEmail = false,
}: EmployeeSelectProps) {
  const options: SearchableSelectOption[] = React.useMemo(() => {
    return employees.map((employee) => ({
      value: employee.id,
      label: `${employee.firstName} ${employee.lastName}`,
      description: [
        employee.employeeCode,
        employee.designation,
        showDepartment && employee.department?.name,
        showEmail && employee.email,
      ]
        .filter(Boolean)
        .join(" • "),
    }))
  }, [employees, showDepartment, showEmail])

  const renderOption = (option: SearchableSelectOption) => {
    const employee = employees.find((emp) => emp.id === option.value)
    if (!employee) return null

    return (
      <div className="flex flex-col">
        <div className="font-medium">
          {employee.firstName} {employee.lastName}
        </div>
        <div className="text-xs text-muted-foreground">
          {[
            employee.employeeCode,
            employee.designation,
            showDepartment && employee.department?.name,
            showEmail && employee.email,
          ]
            .filter(Boolean)
            .join(" • ")}
        </div>
      </div>
    )
  }

  const renderValue = (option: SearchableSelectOption | null) => {
    if (!option) return null
    const employee = employees.find((emp) => emp.id === option.value)
    if (!employee) return null

    return (
      <div className="flex flex-col">
        <div className="truncate">
          {employee.firstName} {employee.lastName}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {employee.employeeCode} • {employee.designation}
        </div>
      </div>
    )
  }

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder="Search employees..."
      emptyMessage="No employees found."
      disabled={disabled}
      className={className}
      loading={loading}
      allowClear={allowClear}
      renderOption={renderOption}
      renderValue={renderValue}
    />
  )
}

// Hook for easier integration with react-hook-form
export function useEmployeeSelect(employees: Employee[], defaultValue?: string) {
  const [value, setValue] = React.useState(defaultValue || "")

  const selectedEmployee = employees.find((employee) => employee.id === value)

  return {
    value,
    setValue,
    selectedEmployee,
    props: {
      employees,
      value,
      onValueChange: setValue,
    },
  }
}

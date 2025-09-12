"use client"

import * as React from "react"
import { SearchableSelect, SearchableSelectOption } from "./searchable-select"

export interface Department {
  id: string
  name: string
  code?: string
  description?: string
  _count?: {
    employees: number
  }
}

interface DepartmentSelectProps {
  departments: Department[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  loading?: boolean
  allowClear?: boolean
  showEmployeeCount?: boolean
  showDescription?: boolean
}

export function DepartmentSelect({
  departments,
  value,
  onValueChange,
  placeholder = "Select department...",
  disabled = false,
  className,
  loading = false,
  allowClear = true,
  showEmployeeCount = true,
  showDescription = false,
}: DepartmentSelectProps) {
  const options: SearchableSelectOption[] = React.useMemo(() => {
    return departments.map((department) => ({
      value: department.id,
      label: department.name,
      description: [
        department.code,
        showDescription && department.description,
        showEmployeeCount && department._count?.employees !== undefined
          ? `${department._count.employees} employees`
          : null,
      ]
        .filter(Boolean)
        .join(" • "),
    }))
  }, [departments, showEmployeeCount, showDescription])

  const renderOption = (option: SearchableSelectOption) => {
    const department = departments.find((dept) => dept.id === option.value)
    if (!department) return null

    return (
      <div className="flex flex-col">
        <div className="font-medium">{department.name}</div>
        <div className="text-xs text-muted-foreground">
          {[
            department.code,
            showDescription && department.description,
            showEmployeeCount && department._count?.employees !== undefined
              ? `${department._count.employees} employees`
              : null,
          ]
            .filter(Boolean)
            .join(" • ")}
        </div>
      </div>
    )
  }

  const renderValue = (option: SearchableSelectOption | null) => {
    if (!option) return null
    const department = departments.find((dept) => dept.id === option.value)
    if (!department) return null

    return (
      <div className="flex items-center gap-2">
        <span className="truncate">{department.name}</span>
        {showEmployeeCount && department._count?.employees !== undefined && (
          <span className="text-xs text-muted-foreground">
            ({department._count.employees})
          </span>
        )}
      </div>
    )
  }

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder="Search departments..."
      emptyMessage="No departments found."
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
export function useDepartmentSelect(departments: Department[], defaultValue?: string) {
  const [value, setValue] = React.useState(defaultValue || "")

  const selectedDepartment = departments.find((department) => department.id === value)

  return {
    value,
    setValue,
    selectedDepartment,
    props: {
      departments,
      value,
      onValueChange: setValue,
    },
  }
}

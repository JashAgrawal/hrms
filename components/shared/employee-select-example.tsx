"use client"

import { useState } from "react"
import { EmployeeSelect } from "./employee-select"
import { useEmployees } from "@/hooks/use-employees"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "../ui/skeleton"

export function EmployeeSelectExample() {
  const [singleEmployee, setSingleEmployee] = useState<string>("")
  const [multipleEmployees, setMultipleEmployees] = useState<string[]>([])
  
  const { employees, loading, error } = useEmployees()

  if (loading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Employee Selection Examples</CardTitle>
          <CardDescription>Loading employees...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Employee Selection Examples</CardTitle>
          <CardDescription className="text-destructive">
            Error loading employees: {error}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Employee Selection Examples</CardTitle>
        <CardDescription>
          Searchable employee selection with support for single and multiple selection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Single Employee Selection */}
        <div className="space-y-2">
          <Label htmlFor="single-employee">Select Single Employee</Label>
          <EmployeeSelect
            employees={employees}
            value={singleEmployee}
            onValueChange={(value) => setSingleEmployee(value as string)}
            placeholder="Choose an employee..."
          />
          {singleEmployee && (
            <p className="text-sm text-muted-foreground">
              Selected: {singleEmployee}
            </p>
          )}
        </div>

        {/* Multiple Employee Selection */}
        <div className="space-y-2">
          <Label htmlFor="multiple-employees">Select Multiple Employees</Label>
          <EmployeeSelect
            employees={employees}
            value={multipleEmployees}
            onValueChange={(value) => setMultipleEmployees(value as string[])}
            placeholder="Choose employees..."
            multiple
            maxDisplayed={2}
          />
          {multipleEmployees.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Selected {multipleEmployees.length} employee(s): {multipleEmployees.join(", ")}
            </p>
          )}
        </div>

        {/* Statistics */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Total employees available: {employees.length}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
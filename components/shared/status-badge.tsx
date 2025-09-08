import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  variant?: "default" | "outline"
  className?: string
}

const statusConfig = {
  // Employee Status
  active: { variant: "success" as const, label: "Active" },
  inactive: { variant: "error" as const, label: "Inactive" },
  pending: { variant: "warning" as const, label: "Pending" },
  
  // Attendance Status
  present: { variant: "attendance" as const, label: "Present" },
  absent: { variant: "error" as const, label: "Absent" },
  late: { variant: "warning" as const, label: "Late" },
  "half-day": { variant: "info" as const, label: "Half Day" },
  
  // Leave Status
  approved: { variant: "success" as const, label: "Approved" },
  rejected: { variant: "error" as const, label: "Rejected" },
  "pending-approval": { variant: "warning" as const, label: "Pending" },
  cancelled: { variant: "secondary" as const, label: "Cancelled" },
  
  // Payroll Status
  processed: { variant: "payroll" as const, label: "Processed" },
  draft: { variant: "secondary" as const, label: "Draft" },
  failed: { variant: "error" as const, label: "Failed" },
  
  // Expense Status
  submitted: { variant: "info" as const, label: "Submitted" },
  "under-review": { variant: "warning" as const, label: "Under Review" },
  reimbursed: { variant: "expense" as const, label: "Reimbursed" },
  
  // Performance Status
  "in-progress": { variant: "info" as const, label: "In Progress" },
  completed: { variant: "performance" as const, label: "Completed" },
  overdue: { variant: "error" as const, label: "Overdue" },
}

export function StatusBadge({ status, variant = "default", className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase() as keyof typeof statusConfig]
  
  if (!config) {
    return (
      <Badge variant={variant} className={className}>
        {status}
      </Badge>
    )
  }
  
  return (
    <Badge 
      variant={variant === "outline" ? "outline" : config.variant} 
      className={cn(
        variant === "outline" && "border-current",
        className
      )}
    >
      {config.label}
    </Badge>
  )
}
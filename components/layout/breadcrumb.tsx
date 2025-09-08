"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  className?: string
}

// Route mapping for better breadcrumb labels
const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  employees: "Employees",
  attendance: "Attendance",
  leave: "Leave Management",
  payroll: "Payroll",
  expenses: "Expenses",
  travel: "Travel",
  performance: "Performance",
  documents: "Documents",
  settings: "Settings",
  reports: "Reports",
  policies: "Policies",
  structure: "Salary Structure",
  payslips: "Payslips",
  requests: "Requests",
  team: "Team",
  reviews: "Reviews",
  company: "Company",
  departments: "Departments",
  onboarding: "Onboarding",
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const pathname = usePathname()
  
  // Generate breadcrumb items from pathname if not provided
  const breadcrumbItems = React.useMemo(() => {
    if (items) return items

    const segments = pathname.split("/").filter(Boolean)
    const generatedItems: BreadcrumbItem[] = []

    // Add home/dashboard
    generatedItems.push({
      label: "Dashboard",
      href: "/dashboard"
    })

    // Build breadcrumb from path segments
    let currentPath = ""
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      
      // Skip the first 'dashboard' segment as we already added it
      if (segment === "dashboard") return
      
      const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
      
      // Don't add href for the last item (current page)
      const isLast = index === segments.length - 1
      
      generatedItems.push({
        label,
        href: isLast ? undefined : currentPath
      })
    })

    return generatedItems
  }, [pathname, items])

  if (breadcrumbItems.length <= 1) return null

  return (
    <nav className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}>
      <Home className="h-4 w-4" />
      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="h-4 w-4" />}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
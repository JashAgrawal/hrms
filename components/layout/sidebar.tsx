"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Users,
  Clock,
  Calendar,
  DollarSign,
  Receipt,
  Target,
  FileText,
  Settings,
  Home,
  ChevronDown,
  Building2,
  UserCheck,
  Briefcase,
  Megaphone,
  FolderOpen,
  MapPin
} from "lucide-react"
import { Logo } from "@/components/shared/logo"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface NavItem {
  title: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavItem[]
  roles?: string[]
}

const navigationItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Employee Management",
    icon: Users,
    roles: ["ADMIN", "HR", "MANAGER"],
    children: [
      {
        title: "All Employees",
        href: "/dashboard/employees",
        icon: Users,
      },
      {
        title: "Departments",
        href: "/dashboard/departments",
        icon: Building2,
      },
      {
        title: "Onboarding",
        href: "/dashboard/onboarding",
        icon: UserCheck,
        roles: ["ADMIN", "HR"],
      },
    ],
  },
  {
    title: "Attendance",
    icon: Clock,
    children: [
      {
        title: "Mark Attendance",
        href: "/dashboard/attendance",
        icon: Clock,
      },
      {
        title: "Site Visits",
        href: "/dashboard/site-visits",
        icon: MapPin,
        roles: ["ADMIN", "HR", "MANAGER"],
      },
      {
        title: "Attendance Reports",
        href: "/dashboard/attendance/reports",
        icon: FileText,
        roles: ["ADMIN", "HR", "MANAGER"],
      },
      {
        title: "Attendance Requests",
        href: "/dashboard/attendance/requests",
        icon: FileText,
        roles: ["ADMIN", "HR", "MANAGER"],
      },
    ],
  },
  {
    title: "Time Tracker",
    icon: FolderOpen,
    children: [
      {
        title: "Dashboard",
        href: "/dashboard/time-tracker",
        icon: Home,
      },
      {
        title: "Timesheets",
        href: "/dashboard/time-tracker/timesheets",
        icon: Clock,
      },
      {
        title: "Manage Timesheets",
        href: "/dashboard/time-tracker/timesheets/manage",
        icon: UserCheck,
        roles: ["ADMIN", "HR", "MANAGER"],
      },
      {
        title: "Projects",
        href: "/dashboard/time-tracker/projects",
        icon: FolderOpen,
        roles: ["ADMIN", "HR", "MANAGER"],
      },
      {
        title: "Reports",
        href: "/dashboard/time-tracker/reports",
        icon: FileText,
        roles: ["ADMIN", "HR", "MANAGER"],
      },
    ],
  },
  {
    title: "Leave Management",
    icon: Calendar,
    children: [
      {
        title: "My Leaves",
        href: "/dashboard/leave",
        icon: Calendar,
      },
      {
        title: "Leave Requests",
        href: "/dashboard/leave/requests",
        icon: Calendar,
        roles: ["ADMIN", "HR", "MANAGER"],
      },
      {
        title: "Leave Policies",
        href: "/dashboard/leave/policies",
        icon: FileText,
        roles: ["ADMIN", "HR"],
      },
    ],
  },
  {
    title: "Payroll",
    icon: DollarSign,
    children: [
      {
        title: "My Payslips",
        href: "/dashboard/payroll/my-payslips",
        icon: FileText,
      },
      {
        title: "Payroll Runs",
        href: "/dashboard/payroll",
        icon: DollarSign,
        roles: ["ADMIN", "HR", "FINANCE"],
      },
      {
        title: "Salary Structure",
        href: "/dashboard/payroll/structure",
        icon: DollarSign,
        roles: ["ADMIN", "HR", "FINANCE"],
      },
    ],
  },
  {
    title: "Expenses & Travel",
    icon: Receipt,
    children: [
      {
        title: "My Expenses",
        href: "/dashboard/expenses",
        icon: Receipt,
      },
      {
        title: "Travel Requests",
        href: "/dashboard/travel",
        icon: Briefcase,
      },
      {
        title: "Expense Reports",
        href: "/dashboard/expenses/reports",
        icon: FileText,
        roles: ["ADMIN", "HR", "MANAGER", "FINANCE"],
      },
    ],
  },
  {
    title: "Performance",
    icon: Target,
    children: [
      {
        title: "My Performance",
        href: "/dashboard/performance",
        icon: Target,
      },
      {
        title: "Team Performance",
        href: "/dashboard/performance/team",
        icon: Target,
        roles: ["ADMIN", "HR", "MANAGER"],
      },
      {
        title: "Reviews",
        href: "/dashboard/performance/reviews",
        icon: FileText,
        roles: ["ADMIN", "HR", "MANAGER"],
      },
    ],
  },
  {
    title: "Documents",
    icon: FileText,
    children: [
      {
        title: "My Documents",
        href: "/dashboard/documents",
        icon: FileText,
      },
      {
        title: "Company Documents",
        href: "/dashboard/documents/company",
        icon: FileText,
        roles: ["ADMIN", "HR"],
      },
    ],
  },
  {
    title: "Announcements",
    href: "/dashboard/announcements",
    icon: Megaphone,
  },
  {
    title: "Locations",
    href: "/dashboard/locations",
    icon: Building2,
    roles: ["ADMIN", "HR"],
  },
  {
    title: "Audit Logs",
    href: "/dashboard/audit-logs",
    icon: FileText,
    roles: ["ADMIN"],
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["ADMIN"],
  },
]

interface SidebarProps {
  userRole?: string
  className?: string
}

export function Sidebar({ userRole = "EMPLOYEE", className }: SidebarProps) {
  const pathname = usePathname()
  const [openItems, setOpenItems] = React.useState<string[]>([])

  const toggleItem = (title: string) => {
    setOpenItems(prev => 
      prev.includes(title) 
        ? prev.filter(item => item !== title)
        : [...prev, title]
    )
  }

  const hasAccess = (roles?: string[]) => {
    if (!roles) return true
    return roles.includes(userRole)
  }

  const renderNavItem = (item: NavItem, level = 0) => {
    if (!hasAccess(item.roles)) return null

    const isActive = item.href ? pathname === item.href : false
    const isOpen = openItems.includes(item.title)
    const hasChildren = item.children && item.children.length > 0

    if (hasChildren) {
      return (
        <Collapsible key={item.title} open={isOpen} onOpenChange={() => toggleItem(item.title)}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 px-3 py-2 h-auto font-normal",
                level > 0 && "pl-6",
                isActive && "bg-accent text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.title}</span>
              <ChevronDown className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                isOpen && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1">
            {item.children?.map(child => renderNavItem(child, level + 1))}
          </CollapsibleContent>
        </Collapsible>
      )
    }

    return (
      <Button
        key={item.title}
        variant="ghost"
        className={cn(
          "w-full justify-start gap-2 px-3 py-2 h-auto font-normal",
          level > 0 && "pl-6",
          isActive && "bg-accent text-accent-foreground"
        )}
        asChild
      >
        <Link href={item.href!}>
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.title}</span>
        </Link>
      </Button>
    )
  }

  return (
    <div className={cn("flex h-full w-64 flex-col border-r bg-sidebar", className)}>
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Logo href="/dashboard" size="md" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navigationItems.map(item => renderNavItem(item))}
      </nav>

      {/* User Role Badge */}
      <div className="border-t p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span>Logged in as {userRole}</span>
        </div>
      </div>
    </div>
  )
}
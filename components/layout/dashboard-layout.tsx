"use client"

import * as React from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { Breadcrumb } from "./breadcrumb"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: React.ReactNode
  user?: {
    name: string
    email: string
    avatar?: string
    role: string
  }
  className?: string
}

export function DashboardLayout({ children, user, className }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar userRole={user?.role} />
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">
            {/* Breadcrumb */}
            <div className="mb-6">
              <Breadcrumb />
            </div>

            {/* Page content */}
            <div className={cn("space-y-6", className)}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
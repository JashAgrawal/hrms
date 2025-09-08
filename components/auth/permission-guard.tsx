"use client"

import { useSession } from "next-auth/react"
import { ReactNode, useEffect, useState } from "react"
import { Permission, hasPermission } from "@/lib/permissions"

interface PermissionGuardProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
  context?: {
    targetUserId?: string
    departmentId?: string
    resourceId?: string
  }
}

/**
 * Component to conditionally render content based on user permissions
 */
export function PermissionGuard({ 
  permission, 
  children, 
  fallback = null,
  context
}: PermissionGuardProps) {
  const { data: session, status } = useSession()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkPermission() {
      if (!session?.user?.id) {
        setHasAccess(false)
        setLoading(false)
        return
      }

      try {
        const result = await fetch('/api/auth/check-permission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            permission,
            context
          })
        })

        const data = await result.json()
        setHasAccess(data.allowed || false)
      } catch (error) {
        console.error('Permission check failed:', error)
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }

    if (status !== "loading") {
      checkPermission()
    }
  }, [session?.user?.id, permission, context, status])

  // Show loading state
  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center p-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Not authenticated or no access
  if (!session?.user || !hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface CanCreateProps {
  resource: string
  module?: string
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Convenience component for create permissions
 */
export function CanCreate({ 
  resource, 
  module = "HR", 
  children, 
  fallback = null 
}: CanCreateProps) {
  return (
    <PermissionGuard 
      permission={{ module, action: "CREATE", resource }} 
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  )
}

interface CanEditProps {
  resource: string
  module?: string
  children: ReactNode
  fallback?: ReactNode
  context?: {
    targetUserId?: string
    departmentId?: string
    resourceId?: string
  }
}

/**
 * Convenience component for edit permissions
 */
export function CanEdit({ 
  resource, 
  module = "HR", 
  children, 
  fallback = null,
  context
}: CanEditProps) {
  return (
    <PermissionGuard 
      permission={{ module, action: "UPDATE", resource }} 
      fallback={fallback}
      context={context}
    >
      {children}
    </PermissionGuard>
  )
}

interface CanDeleteProps {
  resource: string
  module?: string
  children: ReactNode
  fallback?: ReactNode
  context?: {
    targetUserId?: string
    departmentId?: string
    resourceId?: string
  }
}

/**
 * Convenience component for delete permissions
 */
export function CanDelete({ 
  resource, 
  module = "HR", 
  children, 
  fallback = null,
  context
}: CanDeleteProps) {
  return (
    <PermissionGuard 
      permission={{ module, action: "DELETE", resource }} 
      fallback={fallback}
      context={context}
    >
      {children}
    </PermissionGuard>
  )
}

interface CanApproveProps {
  resource: string
  module?: string
  children: ReactNode
  fallback?: ReactNode
  context?: {
    targetUserId?: string
    departmentId?: string
    resourceId?: string
  }
}

/**
 * Convenience component for approval permissions
 */
export function CanApprove({ 
  resource, 
  module = "LEAVE", 
  children, 
  fallback = null,
  context
}: CanApproveProps) {
  return (
    <PermissionGuard 
      permission={{ module, action: "APPROVE", resource }} 
      fallback={fallback}
      context={context}
    >
      {children}
    </PermissionGuard>
  )
}
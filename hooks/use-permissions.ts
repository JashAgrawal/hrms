"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { UserRole } from "@prisma/client"
import { Permission } from "@/lib/permissions"

interface UsePermissionsResult {
  hasRole: (roles: UserRole | UserRole[]) => boolean
  hasPermission: (permission: Permission, context?: any) => boolean
  checkPermission: (permission: Permission, context?: any) => Promise<boolean>
  isLoading: boolean
  user: any
}

export function usePermissions(): UsePermissionsResult {
  const { data: session, status } = useSession()
  const [permissionCache, setPermissionCache] = useState<Map<string, boolean>>(new Map())
  const [isLoading, setIsLoading] = useState(false)

  const hasRole = useCallback((roles: UserRole | UserRole[]): boolean => {
    if (!session?.user?.role) return false
    
    const allowedRoles = Array.isArray(roles) ? roles : [roles]
    return allowedRoles.includes(session.user.role)
  }, [session?.user?.role])

  const generateCacheKey = (permission: Permission, context?: any): string => {
    return JSON.stringify({ permission, context })
  }

  const hasPermission = useCallback((permission: Permission, context?: any): boolean => {
    if (!session?.user) return false
    
    // Admin has all permissions
    if (session.user.role === UserRole.ADMIN) return true
    
    const cacheKey = generateCacheKey(permission, context)
    return permissionCache.get(cacheKey) || false
  }, [session?.user, permissionCache])

  const checkPermission = useCallback(async (permission: Permission, context?: any): Promise<boolean> => {
    if (!session?.user) return false
    
    // Admin has all permissions
    if (session.user.role === UserRole.ADMIN) return true
    
    const cacheKey = generateCacheKey(permission, context)
    
    // Check cache first
    if (permissionCache.has(cacheKey)) {
      return permissionCache.get(cacheKey)!
    }

    setIsLoading(true)
    
    try {
      const response = await fetch('/api/auth/check-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permission,
          context
        })
      })

      const data = await response.json()
      const allowed = data.allowed || false
      
      // Cache the result
      setPermissionCache(prev => new Map(prev).set(cacheKey, allowed))
      
      return allowed
    } catch (error) {
      console.error('Permission check failed:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [session?.user, permissionCache])

  // Clear cache when user changes
  useEffect(() => {
    setPermissionCache(new Map())
  }, [session?.user?.id])

  return {
    hasRole,
    hasPermission,
    checkPermission,
    isLoading: status === "loading" || isLoading,
    user: session?.user
  }
}

// Convenience hooks for common permission checks
export function useCanCreate(resource: string, module: string = "HR") {
  const { hasPermission, checkPermission } = usePermissions()
  
  return {
    canCreate: hasPermission({ module, action: "CREATE", resource }),
    checkCanCreate: () => checkPermission({ module, action: "CREATE", resource })
  }
}

export function useCanEdit(resource: string, module: string = "HR", context?: any) {
  const { hasPermission, checkPermission } = usePermissions()
  
  return {
    canEdit: hasPermission({ module, action: "UPDATE", resource }, context),
    checkCanEdit: () => checkPermission({ module, action: "UPDATE", resource }, context)
  }
}

export function useCanDelete(resource: string, module: string = "HR", context?: any) {
  const { hasPermission, checkPermission } = usePermissions()
  
  return {
    canDelete: hasPermission({ module, action: "DELETE", resource }, context),
    checkCanDelete: () => checkPermission({ module, action: "DELETE", resource }, context)
  }
}

export function useCanApprove(resource: string, module: string = "LEAVE", context?: any) {
  const { hasPermission, checkPermission } = usePermissions()
  
  return {
    canApprove: hasPermission({ module, action: "APPROVE", resource }, context),
    checkCanApprove: () => checkPermission({ module, action: "APPROVE", resource }, context)
  }
}

export function useIsAdmin() {
  const { hasRole } = usePermissions()
  return hasRole(UserRole.ADMIN)
}

export function useIsHR() {
  const { hasRole } = usePermissions()
  return hasRole([UserRole.ADMIN, UserRole.HR])
}

export function useIsManager() {
  const { hasRole } = usePermissions()
  return hasRole([UserRole.ADMIN, UserRole.HR, UserRole.MANAGER])
}

export function useIsFinance() {
  const { hasRole } = usePermissions()
  return hasRole([UserRole.ADMIN, UserRole.FINANCE])
}
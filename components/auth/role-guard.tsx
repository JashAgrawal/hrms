"use client"

import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import { ReactNode } from "react"

interface RoleGuardProps {
  allowedRoles: UserRole[]
  children: ReactNode
  fallback?: ReactNode
  requireAll?: boolean
}

/**
 * Component to conditionally render content based on user roles
 */
export function RoleGuard({ 
  allowedRoles, 
  children, 
  fallback = null,
  requireAll = false 
}: RoleGuardProps) {
  const { data: session, status } = useSession()

  // Show loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Not authenticated
  if (!session?.user) {
    return <>{fallback}</>
  }

  // Check if user has required role(s)
  const userRole = session.user.role
  const hasAccess = requireAll 
    ? allowedRoles.every(role => role === userRole)
    : allowedRoles.includes(userRole)

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface AdminOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Convenience component for admin-only content
 */
export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

interface HROnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Convenience component for HR-only content
 */
export function HROnly({ children, fallback = null }: HROnlyProps) {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.HR]} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

interface ManagerOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Convenience component for manager+ content
 */
export function ManagerOnly({ children, fallback = null }: ManagerOnlyProps) {
  return (
    <RoleGuard 
      allowedRoles={[UserRole.ADMIN, UserRole.HR, UserRole.MANAGER]} 
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  )
}

interface FinanceOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Convenience component for finance-only content
 */
export function FinanceOnly({ children, fallback = null }: FinanceOnlyProps) {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.FINANCE]} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}
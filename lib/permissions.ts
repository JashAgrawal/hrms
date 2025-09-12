import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"

// Permission structure
export interface Permission {
  module: string
  action: string
  resource: string
}

// Permission checking result
export interface PermissionResult {
  allowed: boolean
  reason?: string
}

// Built-in permission matrix for basic role-based access
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Admin has all permissions - represented by wildcard
    { module: "*", action: "*", resource: "*" }
  ],
  [UserRole.HR]: [
    // Employee Management
    { module: "HR", action: "CREATE", resource: "EMPLOYEE" },
    { module: "HR", action: "READ", resource: "EMPLOYEE" },
    { module: "HR", action: "UPDATE", resource: "EMPLOYEE" },
    { module: "HR", action: "DELETE", resource: "EMPLOYEE" },
    
    // Attendance Management
    { module: "ATTENDANCE", action: "READ", resource: "RECORD" },
    { module: "ATTENDANCE", action: "UPDATE", resource: "RECORD" },
    { module: "ATTENDANCE", action: "APPROVE", resource: "CORRECTION" },
    
    // Leave Management
    { module: "LEAVE", action: "READ", resource: "REQUEST" },
    { module: "LEAVE", action: "APPROVE", resource: "REQUEST" },
    { module: "LEAVE", action: "REJECT", resource: "REQUEST" },
    
    // Performance Management
    { module: "PERFORMANCE", action: "READ", resource: "REVIEW" },
    { module: "PERFORMANCE", action: "CREATE", resource: "REVIEW" },
    { module: "PERFORMANCE", action: "UPDATE", resource: "REVIEW" },
    
    // Document Management
    { module: "DOCUMENT", action: "READ", resource: "ALL" },
    { module: "DOCUMENT", action: "CREATE", resource: "ALL" },
    { module: "DOCUMENT", action: "UPDATE", resource: "ALL" },
    { module: "DOCUMENT", action: "DELETE", resource: "ALL" },
    
    // Reports
    { module: "REPORT", action: "READ", resource: "HR" },
    { module: "REPORT", action: "GENERATE", resource: "HR" }
  ],
  [UserRole.MANAGER]: [
    // Employee Management (limited)
    { module: "HR", action: "READ", resource: "EMPLOYEE" },
    { module: "HR", action: "UPDATE", resource: "EMPLOYEE" }, // Own team only
    
    // Attendance Management
    { module: "ATTENDANCE", action: "READ", resource: "RECORD" }, // Own team only
    { module: "ATTENDANCE", action: "UPDATE", resource: "RECORD" }, // Own team only
    { module: "ATTENDANCE", action: "APPROVE", resource: "CORRECTION" },
    
    // Leave Management
    { module: "LEAVE", action: "READ", resource: "REQUEST" }, // Own team only
    { module: "LEAVE", action: "APPROVE", resource: "REQUEST" },
    { module: "LEAVE", action: "REJECT", resource: "REQUEST" },
    
    // Performance Management
    { module: "PERFORMANCE", action: "READ", resource: "REVIEW" }, // Own team only
    { module: "PERFORMANCE", action: "CREATE", resource: "REVIEW" },
    { module: "PERFORMANCE", action: "UPDATE", resource: "REVIEW" },
    
    // Expense Management
    { module: "EXPENSE", action: "READ", resource: "CLAIM" }, // Own team only
    { module: "EXPENSE", action: "APPROVE", resource: "CLAIM" },
    { module: "EXPENSE", action: "REJECT", resource: "CLAIM" },
    
    // Reports
    { module: "REPORT", action: "READ", resource: "TEAM" },
    { module: "REPORT", action: "GENERATE", resource: "TEAM" }
  ],
  [UserRole.FINANCE]: [
    // Employee Management (read-only for payroll)
    { module: "HR", action: "READ", resource: "EMPLOYEE" },
    
    // Payroll Management
    { module: "PAYROLL", action: "CREATE", resource: "RUN" },
    { module: "PAYROLL", action: "READ", resource: "RUN" },
    { module: "PAYROLL", action: "UPDATE", resource: "RUN" },
    { module: "PAYROLL", action: "DELETE", resource: "RUN" },
    { module: "PAYROLL", action: "PROCESS", resource: "RUN" },
    { module: "PAYROLL", action: "APPROVE", resource: "RUN" },
    
    // Expense Management
    { module: "EXPENSE", action: "READ", resource: "CLAIM" },
    { module: "EXPENSE", action: "APPROVE", resource: "CLAIM" },
    { module: "EXPENSE", action: "REJECT", resource: "CLAIM" },
    { module: "EXPENSE", action: "PROCESS", resource: "REIMBURSEMENT" },
    
    // Financial Reports
    { module: "REPORT", action: "READ", resource: "FINANCE" },
    { module: "REPORT", action: "GENERATE", resource: "FINANCE" },
    { module: "REPORT", action: "READ", resource: "PAYROLL" },
    { module: "REPORT", action: "GENERATE", resource: "PAYROLL" }
  ],
  [UserRole.EMPLOYEE]: [
    // Own Profile Management
    { module: "HR", action: "READ", resource: "EMPLOYEE" }, // Own profile only
    { module: "HR", action: "UPDATE", resource: "EMPLOYEE" }, // Own profile only
    
    // Own Attendance
    { module: "ATTENDANCE", action: "CREATE", resource: "RECORD" },
    { module: "ATTENDANCE", action: "READ", resource: "RECORD" }, // Own records only
    
    // Own Leave Management
    { module: "LEAVE", action: "CREATE", resource: "REQUEST" },
    { module: "LEAVE", action: "READ", resource: "REQUEST" }, // Own requests only
    { module: "LEAVE", action: "UPDATE", resource: "REQUEST" }, // Own pending requests only
    { module: "LEAVE", action: "DELETE", resource: "REQUEST" }, // Own pending requests only
    
    // Own Expense Management
    { module: "EXPENSE", action: "CREATE", resource: "CLAIM" },
    { module: "EXPENSE", action: "READ", resource: "CLAIM" }, // Own claims only
    { module: "EXPENSE", action: "UPDATE", resource: "CLAIM" }, // Own pending claims only
    { module: "EXPENSE", action: "DELETE", resource: "CLAIM" }, // Own pending claims only
    
    // Own Performance Reviews
    { module: "PERFORMANCE", action: "READ", resource: "REVIEW" }, // Own reviews only
    { module: "PERFORMANCE", action: "UPDATE", resource: "REVIEW" }, // Self-assessment only
    
    // Own Documents
    { module: "DOCUMENT", action: "READ", resource: "OWN" },
    { module: "DOCUMENT", action: "CREATE", resource: "OWN" },
    
    // Own Payroll
    { module: "PAYROLL", action: "READ", resource: "OWN" }
  ]
}

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  userId: string,
  permission: Permission,
  context?: {
    targetUserId?: string
    departmentId?: string
    resourceId?: string
  }
): Promise<PermissionResult> {
  try {
    // Get user with role and employee information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: {
          include: {
            department: true
          }
        },
        customRole: {
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    })

    if (!user || !user.isActive) {
      return { allowed: false, reason: "User not found or inactive" }
    }

    // Check built-in role permissions first
    const rolePermissions = ROLE_PERMISSIONS[user.role] || []
    
    // Admin has all permissions
    if (user.role === UserRole.ADMIN) {
      return { allowed: true }
    }

    // Check if user has the required permission
    const hasRolePermission = rolePermissions.some(p => 
      (p.module === "*" || p.module === permission.module) &&
      (p.action === "*" || p.action === permission.action) &&
      (p.resource === "*" || p.resource === permission.resource)
    )

    if (!hasRolePermission) {
      return { allowed: false, reason: "Insufficient role permissions" }
    }

    // Apply context-based restrictions for non-admin users
    if (context) {
      const contextCheck = await checkContextualPermissions(user, permission, context)
      if (!contextCheck.allowed) {
        return contextCheck
      }
    }

    // Check custom role permissions if user has a custom role
    if (user.customRole) {
      const customPermissions = user.customRole.rolePermissions.map(rp => ({
        module: rp.permission.module,
        action: rp.permission.action,
        resource: rp.permission.resource
      }))

      const hasCustomPermission = customPermissions.some(p =>
        p.module === permission.module &&
        p.action === permission.action &&
        p.resource === permission.resource
      )

      if (!hasCustomPermission) {
        return { allowed: false, reason: "Custom role restrictions apply" }
      }
    }

    return { allowed: true }

  } catch (error) {
    console.error("Permission check error:", error)
    return { allowed: false, reason: "Permission check failed" }
  }
}

/**
 * Check contextual permissions (e.g., own data, team data, department data)
 */
async function checkContextualPermissions(
  user: any,
  permission: Permission,
  context: {
    targetUserId?: string
    departmentId?: string
    resourceId?: string
  }
): Promise<PermissionResult> {
  
  // For employee role, restrict to own data
  if (user.role === UserRole.EMPLOYEE) {
    if (context.targetUserId && context.targetUserId !== user.id) {
      return { allowed: false, reason: "Can only access own data" }
    }
  }

  // For manager role, restrict to own team/department
  if (user.role === UserRole.MANAGER) {
    if (context.targetUserId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: context.targetUserId },
        include: { employee: true }
      })

      if (!targetUser?.employee) {
        return { allowed: false, reason: "Target user not found" }
      }

      // Check if target user is in manager's department or reports to manager
      const isInDepartment = targetUser.employee.departmentId === user.employee?.departmentId
      const reportsToManager = targetUser.employee.reportingTo === user.employee?.id

      if (!isInDepartment && !reportsToManager) {
        return { allowed: false, reason: "Can only access team members' data" }
      }
    }
  }

  return { allowed: true }
}

/**
 * Get all permissions for a user role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Check if user can access a specific module
 */
export async function canAccessModule(userId: string, module: string): Promise<boolean> {
  const result = await hasPermission(userId, { module, action: "READ", resource: "*" })
  return result.allowed
}

/**
 * Get user's effective permissions (role + custom permissions)
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        customRole: {
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    })

    if (!user) return []

    const rolePermissions = ROLE_PERMISSIONS[user.role] || []
    
    if (user.customRole) {
      const customPermissions = user.customRole.rolePermissions.map(rp => ({
        module: rp.permission.module,
        action: rp.permission.action,
        resource: rp.permission.resource
      }))
      
      // Merge role and custom permissions (custom permissions can override role permissions)
      return [...rolePermissions, ...customPermissions]
    }

    return rolePermissions
  } catch (error) {
    console.error("Error getting user permissions:", error)
    return []
  }
}

/**
 * Alias for hasPermission for backward compatibility
 */
export const checkPermission = hasPermission
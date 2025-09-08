import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UserRole } from "@prisma/client"

export async function getSession() {
  return await auth()
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user
}

export async function requireAuth() {
  const session = await getSession()
  
  if (!session?.user || !session.user.isActive) {
    redirect("/auth/signin")
  }
  
  return session.user
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth()
  
  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard?error=Unauthorized")
  }
  
  return user
}

export async function requirePermission(module: string, action: string, resource: string) {
  const user = await requireAuth()
  
  // Admin has all permissions
  if (user.role === UserRole.ADMIN) {
    return user
  }
  
  // TODO: Implement granular permission checking with database
  // For now, use basic role-based checks
  const hasPermission = checkBasicPermission(user.role, module, action, resource)
  
  if (!hasPermission) {
    redirect("/dashboard?error=InsufficientPermissions")
  }
  
  return user
}

function checkBasicPermission(role: UserRole, module: string, action: string, resource: string): boolean {
  // Basic permission matrix - this should be moved to database in production
  const permissions: Record<UserRole, string[]> = {
    [UserRole.ADMIN]: ["*"], // Admin has all permissions
    [UserRole.HR]: [
      "HR.CREATE.EMPLOYEE",
      "HR.READ.EMPLOYEE", 
      "HR.UPDATE.EMPLOYEE",
      "HR.DELETE.EMPLOYEE",
      "HR.READ.ATTENDANCE",
      "HR.UPDATE.ATTENDANCE",
      "HR.READ.LEAVE",
      "HR.APPROVE.LEAVE",
      "HR.READ.PERFORMANCE",
      "HR.CREATE.PERFORMANCE"
    ],
    [UserRole.MANAGER]: [
      "HR.READ.EMPLOYEE",
      "HR.READ.ATTENDANCE", 
      "HR.UPDATE.ATTENDANCE",
      "HR.READ.LEAVE",
      "HR.APPROVE.LEAVE",
      "HR.READ.PERFORMANCE",
      "HR.CREATE.PERFORMANCE",
      "EXPENSE.READ.CLAIM",
      "EXPENSE.APPROVE.CLAIM"
    ],
    [UserRole.FINANCE]: [
      "PAYROLL.CREATE.RUN",
      "PAYROLL.READ.RUN",
      "PAYROLL.UPDATE.RUN",
      "PAYROLL.DELETE.RUN",
      "EXPENSE.READ.CLAIM",
      "EXPENSE.APPROVE.CLAIM",
      "EXPENSE.PROCESS.REIMBURSEMENT"
    ],
    [UserRole.EMPLOYEE]: [
      "HR.READ.EMPLOYEE", // Own profile only
      "HR.UPDATE.EMPLOYEE", // Own profile only
      "HR.CREATE.ATTENDANCE",
      "HR.READ.ATTENDANCE", // Own records only
      "HR.CREATE.LEAVE",
      "HR.READ.LEAVE", // Own requests only
      "EXPENSE.CREATE.CLAIM",
      "EXPENSE.READ.CLAIM", // Own claims only
      "PERFORMANCE.READ.REVIEW" // Own reviews only
    ]
  }
  
  const userPermissions = permissions[role] || []
  const requiredPermission = `${module}.${action}.${resource}`
  
  return userPermissions.includes("*") || userPermissions.includes(requiredPermission)
}
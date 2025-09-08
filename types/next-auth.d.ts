import { UserRole } from "@prisma/client"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      employeeId?: string
      departmentId?: string
      isActive: boolean
      provider?: string
    } & DefaultSession["user"]
  }

  interface User {
    role: UserRole
    employeeId?: string
    departmentId?: string
    isActive: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole
    employeeId?: string
    departmentId?: string
    isActive: boolean
    provider?: string
  }
}
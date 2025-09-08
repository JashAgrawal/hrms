import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasPermission, Permission } from "@/lib/permissions"
import { UserRole } from "@prisma/client"

export interface ApiContext {
  user: {
    id: string
    email: string | null
    name: string | null
    role: UserRole
    employeeId?: string
    departmentId?: string
    isActive: boolean
  }
}

/**
 * Middleware to require authentication for API routes
 */
export async function requireAuth(request: NextRequest): Promise<ApiContext | NextResponse> {
  try {
    const session = await auth()

    if (!session?.user || !session.user.isActive) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        role: session.user.role,
        employeeId: session.user.employeeId,
        departmentId: session.user.departmentId,
        isActive: session.user.isActive
      }
    }
  } catch (error) {
    console.error("Auth middleware error:", error)
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    )
  }
}

/**
 * Middleware to require specific role(s) for API routes
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<ApiContext | NextResponse> {
  const authResult = await requireAuth(request)
  
  if (authResult instanceof NextResponse) {
    return authResult
  }

  if (!allowedRoles.includes(authResult.user.role)) {
    return NextResponse.json(
      { 
        error: "Insufficient permissions",
        required: allowedRoles,
        current: authResult.user.role
      },
      { status: 403 }
    )
  }

  return authResult
}

/**
 * Middleware to require specific permission for API routes
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission,
  context?: {
    targetUserId?: string
    departmentId?: string
    resourceId?: string
  }
): Promise<ApiContext | NextResponse> {
  const authResult = await requireAuth(request)
  
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const permissionResult = await hasPermission(
    authResult.user.id,
    permission,
    context
  )

  if (!permissionResult.allowed) {
    return NextResponse.json(
      { 
        error: "Permission denied",
        reason: permissionResult.reason,
        required: permission
      },
      { status: 403 }
    )
  }

  return authResult
}

/**
 * Higher-order function to create protected API route handlers
 */
export function withAuth(
  handler: (context: ApiContext, request: NextRequest, routeContext?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const authResult = await requireAuth(request)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }

    try {
      return await handler(authResult, request, routeContext)
    } catch (error) {
      console.error("API handler error:", error)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }
  }
}

/**
 * Higher-order function to create role-protected API route handlers
 */
export function withRole(
  allowedRoles: UserRole[],
  handler: (context: ApiContext, request: NextRequest, routeContext?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const authResult = await requireRole(request, allowedRoles)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }

    try {
      return await handler(authResult, request, routeContext)
    } catch (error) {
      console.error("API handler error:", error)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }
  }
}

/**
 * Higher-order function to create permission-protected API route handlers
 */
export function withPermission(
  permission: Permission,
  handler: (context: ApiContext, request: NextRequest, routeContext?: any) => Promise<NextResponse>,
  getContext?: (request: NextRequest, routeContext?: any) => Promise<{
    targetUserId?: string
    departmentId?: string
    resourceId?: string
  }>
) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    let context: any = {}
    
    if (getContext) {
      try {
        context = await getContext(request, routeContext)
      } catch (error) {
        console.error("Context extraction error:", error)
        return NextResponse.json(
          { error: "Invalid request context" },
          { status: 400 }
        )
      }
    }

    const authResult = await requirePermission(request, permission, context)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }

    try {
      return await handler(authResult, request, routeContext)
    } catch (error) {
      console.error("API handler error:", error)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }
  }
}

/**
 * Utility to extract user ID from URL parameters
 */
export function extractUserIdFromParams(params: { userId?: string }): string | undefined {
  return params.userId
}

/**
 * Utility to extract resource ID from URL parameters
 */
export function extractResourceIdFromParams(params: { id?: string }): string | undefined {
  return params.id
}

/**
 * Rate limiting middleware (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const now = Date.now()
    const windowStart = now - windowMs

    // Clean up old entries
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetTime < windowStart) {
        rateLimitMap.delete(key)
      }
    }

    const current = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs }
    
    if (current.count >= maxRequests && current.resetTime > now) {
      return NextResponse.json(
        { 
          error: "Too many requests",
          retryAfter: Math.ceil((current.resetTime - now) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((current.resetTime - now) / 1000).toString()
          }
        }
      )
    }

    current.count++
    rateLimitMap.set(ip, current)
    
    return null // Continue to next middleware/handler
  }
}
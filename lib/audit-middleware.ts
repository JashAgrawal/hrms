import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { AuditLogger, AUDIT_ACTIONS, AUDIT_RESOURCES } from '@/lib/audit-service'

export interface AuditConfig {
  action?: string
  resource?: string
  skipAudit?: boolean
  extractResourceId?: (request: NextRequest, response?: NextResponse) => string | undefined
  extractDetails?: (request: NextRequest, response?: NextResponse) => Record<string, any> | undefined
}

/**
 * Middleware wrapper for automatic audit logging
 */
export function withAuditLogging(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  config: AuditConfig = {}
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now()
    let response: NextResponse
    let error: Error | null = null

    try {
      response = await handler(request, context)
    } catch (err) {
      error = err as Error
      response = NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      )
    }

    // Skip audit logging if configured
    if (config.skipAudit) {
      if (error) throw error
      return response
    }

    // Extract audit information
    const session = await auth()
    const { ipAddress, userAgent } = AuditLogger.extractRequestInfo(request)
    
    const action = config.action || inferActionFromRequest(request)
    const resource = config.resource || inferResourceFromPath(request.nextUrl.pathname)
    const resourceId = config.extractResourceId?.(request, response) || extractResourceIdFromPath(request.nextUrl.pathname)
    const details = config.extractDetails?.(request, response) || await extractDetailsFromRequest(request)

    // Log the audit action
    await AuditLogger.logAction({
      userId: session?.user?.id,
      userName: session?.user?.name || undefined,
      action,
      resource,
      resourceId,
      details: {
        ...details,
        method: request.method,
        path: request.nextUrl.pathname,
        statusCode: response.status,
        duration: Date.now() - startTime,
      },
      ipAddress,
      userAgent,
      sessionId: session?.user?.id, // Using user ID as session identifier
      success: !error && response.status < 400,
      errorMessage: error?.message,
    })

    if (error) throw error
    return response
  }
}

/**
 * Infer audit action from HTTP method and path
 */
function inferActionFromRequest(request: NextRequest): string {
  const method = request.method.toUpperCase()
  const path = request.nextUrl.pathname.toLowerCase()

  // Special cases for specific endpoints
  if (path.includes('/approve')) return AUDIT_ACTIONS.APPROVE
  if (path.includes('/reject')) return AUDIT_ACTIONS.REJECT
  if (path.includes('/submit')) return AUDIT_ACTIONS.SUBMIT
  if (path.includes('/cancel')) return AUDIT_ACTIONS.CANCEL
  if (path.includes('/check-in')) return AUDIT_ACTIONS.CHECK_IN
  if (path.includes('/check-out')) return AUDIT_ACTIONS.CHECK_OUT
  if (path.includes('/export')) return AUDIT_ACTIONS.EXPORT
  if (path.includes('/import')) return AUDIT_ACTIONS.IMPORT
  if (path.includes('/calculate')) return AUDIT_ACTIONS.PAYROLL_CALCULATE
  if (path.includes('/finalize')) return AUDIT_ACTIONS.PAYROLL_FINALIZE
  if (path.includes('/download')) return AUDIT_ACTIONS.PAYSLIP_DOWNLOAD

  // Standard CRUD operations
  switch (method) {
    case 'GET':
      return AUDIT_ACTIONS.READ
    case 'POST':
      return path.includes('/bulk') ? AUDIT_ACTIONS.BULK_CREATE : AUDIT_ACTIONS.CREATE
    case 'PUT':
    case 'PATCH':
      return path.includes('/bulk') ? AUDIT_ACTIONS.BULK_UPDATE : AUDIT_ACTIONS.UPDATE
    case 'DELETE':
      return path.includes('/bulk') ? AUDIT_ACTIONS.BULK_DELETE : AUDIT_ACTIONS.DELETE
    default:
      return method
  }
}

/**
 * Infer resource type from API path
 */
function inferResourceFromPath(path: string): string {
  const segments = path.toLowerCase().split('/').filter(Boolean)
  
  // Remove 'api' from segments if present
  const apiIndex = segments.indexOf('api')
  const resourceSegments = apiIndex >= 0 ? segments.slice(apiIndex + 1) : segments

  // Map path segments to resource types
  const resourceMap: Record<string, string> = {
    'users': AUDIT_RESOURCES.USER,
    'employees': AUDIT_RESOURCES.EMPLOYEE,
    'departments': AUDIT_RESOURCES.DEPARTMENT,
    'attendance': AUDIT_RESOURCES.ATTENDANCE,
    'leave': AUDIT_RESOURCES.LEAVE_REQUEST,
    'leaves': AUDIT_RESOURCES.LEAVE_REQUEST,
    'policies': AUDIT_RESOURCES.LEAVE_POLICY,
    'payroll': AUDIT_RESOURCES.PAYROLL_RUN,
    'payslips': AUDIT_RESOURCES.PAYSLIP,
    'salary-structures': AUDIT_RESOURCES.SALARY_STRUCTURE,
    'expenses': AUDIT_RESOURCES.EXPENSE_CLAIM,
    'performance': AUDIT_RESOURCES.PERFORMANCE_REVIEW,
    'roles': AUDIT_RESOURCES.ROLE,
    'permissions': AUDIT_RESOURCES.PERMISSION,
    'locations': AUDIT_RESOURCES.LOCATION,
    'timesheets': AUDIT_RESOURCES.TIMESHEET,
  }

  // Find the first matching resource segment
  for (const segment of resourceSegments) {
    if (resourceMap[segment]) {
      return resourceMap[segment]
    }
  }

  // Default to the first resource segment (capitalized)
  return resourceSegments[0]?.toUpperCase() || 'UNKNOWN'
}

/**
 * Extract resource ID from path parameters
 */
function extractResourceIdFromPath(path: string): string | undefined {
  const segments = path.split('/').filter(Boolean)
  
  // Look for segments that look like IDs (UUIDs, numbers, or specific patterns)
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    
    // Skip known non-ID segments
    if (['api', 'dashboard', 'admin', 'auth'].includes(segment.toLowerCase())) {
      continue
    }
    
    // Check if segment looks like an ID
    if (isLikelyId(segment)) {
      return segment
    }
  }
  
  return undefined
}

/**
 * Check if a string looks like an ID
 */
function isLikelyId(str: string): boolean {
  // UUID pattern
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return true
  }
  
  // CUID pattern
  if (/^c[a-z0-9]{24}$/i.test(str)) {
    return true
  }
  
  // Numeric ID
  if (/^\d+$/.test(str)) {
    return true
  }
  
  return false
}

/**
 * Extract relevant details from request
 */
async function extractDetailsFromRequest(request: NextRequest): Promise<Record<string, any> | undefined> {
  const details: Record<string, any> = {}
  
  // Add query parameters
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  if (Object.keys(searchParams).length > 0) {
    details.queryParams = searchParams
  }
  
  // Add request body for non-GET requests (but limit size and exclude sensitive data)
  if (request.method !== 'GET') {
    try {
      const body = await request.clone().json()
      if (body && typeof body === 'object') {
        // Filter out sensitive fields
        const filteredBody = filterSensitiveData(body)
        if (Object.keys(filteredBody).length > 0) {
          details.requestBody = filteredBody
        }
      }
    } catch {
      // Ignore if body is not JSON or empty
    }
  }
  
  return Object.keys(details).length > 0 ? details : undefined
}

/**
 * Filter out sensitive data from request body
 */
function filterSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }
  
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'credential',
    'private',
  ]
  
  const filtered: any = Array.isArray(data) ? [] : {}
  
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase()
    const isSensitive = sensitiveFields.some(field => keyLower.includes(field))
    
    if (isSensitive) {
      filtered[key] = '[REDACTED]'
    } else if (value && typeof value === 'object') {
      filtered[key] = filterSensitiveData(value)
    } else {
      filtered[key] = value
    }
  }
  
  return filtered
}

/**
 * Helper function to create audit config for specific operations
 */
export const createAuditConfig = {
  login: (): AuditConfig => ({
    action: AUDIT_ACTIONS.LOGIN,
    resource: AUDIT_RESOURCES.USER,
  }),
  
  logout: (): AuditConfig => ({
    action: AUDIT_ACTIONS.LOGOUT,
    resource: AUDIT_RESOURCES.USER,
  }),
  
  employeeCreate: (): AuditConfig => ({
    action: AUDIT_ACTIONS.CREATE,
    resource: AUDIT_RESOURCES.EMPLOYEE,
    extractResourceId: (_, response) => {
      // Extract ID from response if available
      return undefined // Will be handled by response parsing
    },
  }),
  
  payrollApprove: (): AuditConfig => ({
    action: AUDIT_ACTIONS.PAYROLL_APPROVE,
    resource: AUDIT_RESOURCES.PAYROLL_RUN,
  }),
  
  leaveApprove: (): AuditConfig => ({
    action: AUDIT_ACTIONS.LEAVE_APPROVE,
    resource: AUDIT_RESOURCES.LEAVE_REQUEST,
  }),
  
  skipAudit: (): AuditConfig => ({
    skipAudit: true,
  }),
}
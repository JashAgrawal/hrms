import { prisma } from '@/lib/prisma'
import { AuditLog, Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'

export interface AuditAction {
  userId?: string
  userName?: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, any>
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  success?: boolean
  errorMessage?: string
}

export interface AuditLogFilters {
  userId?: string
  action?: string
  resource?: string
  resourceId?: string
  success?: boolean
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
  search?: string
}

export interface PaginatedAuditLogs {
  logs: AuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export class AuditLogger {
  /**
   * Log an audit action to the database
   */
  static async logAction(action: AuditAction): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: action.userId,
          userName: action.userName,
          action: action.action,
          resource: action.resource,
          resourceId: action.resourceId,
          details: action.details ? JSON.parse(JSON.stringify(action.details)) : null,
          oldValues: action.oldValues ? JSON.parse(JSON.stringify(action.oldValues)) : null,
          newValues: action.newValues ? JSON.parse(JSON.stringify(action.newValues)) : null,
          ipAddress: action.ipAddress,
          userAgent: action.userAgent,
          sessionId: action.sessionId,
          success: action.success ?? true,
          errorMessage: action.errorMessage,
        },
      })
    } catch (error) {
      // Log to console if database logging fails to avoid infinite loops
      console.error('Failed to log audit action:', error)
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  static async getAuditLogs(filters: AuditLogFilters): Promise<PaginatedAuditLogs> {
    const {
      userId,
      action,
      resource,
      resourceId,
      success,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      search,
    } = filters

    const where: Prisma.AuditLogWhereInput = {}

    // Apply filters
    if (userId) where.userId = userId
    if (action) where.action = { contains: action, mode: 'insensitive' }
    if (resource) where.resource = { contains: resource, mode: 'insensitive' }
    if (resourceId) where.resourceId = resourceId
    if (typeof success === 'boolean') where.success = success

    // Date range filter
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = startDate
      if (endDate) where.timestamp.lte = endDate
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Export audit logs to CSV format
   */
  static async exportAuditLogs(filters: AuditLogFilters): Promise<string> {
    const { logs } = await this.getAuditLogs({ ...filters, limit: 10000 })

    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Resource',
      'Resource ID',
      'Success',
      'IP Address',
      'Details',
    ]

    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.timestamp.toISOString(),
        log.userName || 'Unknown',
        log.action,
        log.resource,
        log.resourceId || '',
        log.success ? 'Yes' : 'No',
        log.ipAddress || '',
        JSON.stringify(log.details || {}),
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')),
    ]

    return csvRows.join('\n')
  }

  /**
   * Helper method to extract request information
   */
  static extractRequestInfo(request: NextRequest) {
    return {
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }
  }

  /**
   * Get client IP address from request
   */
  private static getClientIP(request: NextRequest): string | undefined {
    // Check various headers for the real IP
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfConnectingIP = request.headers.get('cf-connecting-ip')

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    if (realIP) {
      return realIP
    }
    if (cfConnectingIP) {
      return cfConnectingIP
    }

    return (request as any).ip
  }
}

// Predefined audit actions for consistency
export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',

  // CRUD Operations
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  BULK_CREATE: 'BULK_CREATE',
  BULK_UPDATE: 'BULK_UPDATE',
  BULK_DELETE: 'BULK_DELETE',

  // Approval Workflows
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  SUBMIT: 'SUBMIT',
  CANCEL: 'CANCEL',

  // Payroll Specific
  PAYROLL_CALCULATE: 'PAYROLL_CALCULATE',
  PAYROLL_APPROVE: 'PAYROLL_APPROVE',
  PAYROLL_FINALIZE: 'PAYROLL_FINALIZE',
  PAYSLIP_GENERATE: 'PAYSLIP_GENERATE',
  PAYSLIP_DOWNLOAD: 'PAYSLIP_DOWNLOAD',

  // Attendance Specific
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
  ATTENDANCE_CORRECT: 'ATTENDANCE_CORRECT',

  // Leave Specific
  LEAVE_APPLY: 'LEAVE_APPLY',
  LEAVE_APPROVE: 'LEAVE_APPROVE',
  LEAVE_REJECT: 'LEAVE_REJECT',
  LEAVE_CANCEL: 'LEAVE_CANCEL',

  // System Operations
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  BACKUP: 'BACKUP',
  RESTORE: 'RESTORE',
} as const

// Predefined resource types for consistency
export const AUDIT_RESOURCES = {
  USER: 'USER',
  EMPLOYEE: 'EMPLOYEE',
  DEPARTMENT: 'DEPARTMENT',
  ATTENDANCE: 'ATTENDANCE',
  LEAVE_REQUEST: 'LEAVE_REQUEST',
  LEAVE_POLICY: 'LEAVE_POLICY',
  PAYROLL_RUN: 'PAYROLL_RUN',
  PAYROLL_RECORD: 'PAYROLL_RECORD',
  PAYSLIP: 'PAYSLIP',
  SALARY_STRUCTURE: 'SALARY_STRUCTURE',
  EXPENSE_CLAIM: 'EXPENSE_CLAIM',
  PERFORMANCE_REVIEW: 'PERFORMANCE_REVIEW',
  ROLE: 'ROLE',
  PERMISSION: 'PERMISSION',
  LOCATION: 'LOCATION',
  TIMESHEET: 'TIMESHEET',
} as const
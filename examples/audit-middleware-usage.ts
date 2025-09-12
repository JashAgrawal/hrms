// Example: How to integrate audit logging middleware with existing API routes

import { NextRequest, NextResponse } from 'next/server'
import { withAuditLogging, createAuditConfig } from '@/lib/audit-middleware'
import { AuditLogger, AUDIT_ACTIONS, AUDIT_RESOURCES } from '@/lib/audit-service'

// Example 1: Basic usage with automatic inference
async function handleEmployeeCreate(request: NextRequest) {
  // Your existing handler logic
  const body = await request.json()
  
  // Create employee logic here...
  const employee = { id: 'emp123', name: body.name }
  
  return NextResponse.json(employee, { status: 201 })
}

// Wrap with audit logging - action and resource will be inferred
export const POST = withAuditLogging(handleEmployeeCreate)

// Example 2: Custom configuration
async function handleLeaveApproval(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const leaveId = searchParams.get('id')
  
  // Approval logic here...
  
  return NextResponse.json({ success: true })
}

// Wrap with custom audit config
export const PUT = withAuditLogging(handleLeaveApproval, createAuditConfig.leaveApprove())

// Example 3: Manual audit logging for complex scenarios
async function handlePayrollCalculation(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Complex payroll calculation logic...
    const result = { totalEmployees: 100, totalAmount: 500000 }
    
    // Manual audit logging with custom details
    await AuditLogger.logAction({
      action: AUDIT_ACTIONS.PAYROLL_CALCULATE,
      resource: AUDIT_RESOURCES.PAYROLL_RUN,
      resourceId: 'payroll-2024-01',
      details: {
        totalEmployees: result.totalEmployees,
        totalAmount: result.totalAmount,
        duration: Date.now() - startTime,
      },
      success: true,
    })
    
    return NextResponse.json(result)
  } catch (error) {
    // Log failed operation
    await AuditLogger.logAction({
      action: AUDIT_ACTIONS.PAYROLL_CALCULATE,
      resource: AUDIT_RESOURCES.PAYROLL_RUN,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })
    
    throw error
  }
}

// Example 4: Skip audit logging for health checks
async function handleHealthCheck(request: NextRequest) {
  return NextResponse.json({ status: 'healthy' })
}

export const GET = withAuditLogging(handleHealthCheck, createAuditConfig.skipAudit())

// Example 5: Custom resource ID extraction
async function handleEmployeeUpdate(request: NextRequest) {
  const body = await request.json()
  // Update logic...
  return NextResponse.json({ success: true })
}

export const PATCH = withAuditLogging(handleEmployeeUpdate, {
  action: AUDIT_ACTIONS.UPDATE,
  resource: AUDIT_RESOURCES.EMPLOYEE,
  extractResourceId: (request) => {
    // Extract employee ID from URL path
    const pathSegments = request.nextUrl.pathname.split('/')
    return pathSegments[pathSegments.length - 1]
  },
  extractDetails: async (request) => {
    // Extract specific fields from request body
    const body = await request.clone().json()
    return {
      updatedFields: Object.keys(body),
      updateType: body.salary ? 'salary_update' : 'profile_update',
    }
  },
})

// Example 6: Batch operations with custom logging
async function handleBulkEmployeeImport(request: NextRequest) {
  const employees = await request.json()
  
  try {
    // Process bulk import...
    const results = { created: 50, updated: 10, failed: 2 }
    
    // Log bulk operation with summary
    await AuditLogger.logAction({
      action: AUDIT_ACTIONS.BULK_CREATE,
      resource: AUDIT_RESOURCES.EMPLOYEE,
      details: {
        totalRecords: employees.length,
        results,
        importSource: 'csv_upload',
      },
      success: true,
    })
    
    return NextResponse.json(results)
  } catch (error) {
    await AuditLogger.logAction({
      action: AUDIT_ACTIONS.BULK_CREATE,
      resource: AUDIT_RESOURCES.EMPLOYEE,
      details: {
        totalRecords: employees.length,
        failurePoint: 'processing',
      },
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Bulk import failed',
    })
    
    throw error
  }
}

// Example 7: Authentication events
async function handleLogin(request: NextRequest) {
  const { email, password } = await request.json()
  
  try {
    // Authentication logic...
    const user = { id: 'user123', email }
    
    // Log successful login
    await AuditLogger.logAction({
      action: AUDIT_ACTIONS.LOGIN,
      resource: AUDIT_RESOURCES.USER,
      resourceId: user.id,
      details: {
        email,
        loginMethod: 'password',
      },
      ...AuditLogger.extractRequestInfo(request),
      success: true,
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    // Log failed login attempt
    await AuditLogger.logAction({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      resource: AUDIT_RESOURCES.USER,
      details: {
        email,
        failureReason: 'invalid_credentials',
      },
      ...AuditLogger.extractRequestInfo(request),
      success: false,
      errorMessage: 'Invalid credentials',
    })
    
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
}
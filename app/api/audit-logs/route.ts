import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { AuditLogger } from '@/lib/audit-service'
import { withAuditLogging } from '@/lib/audit-middleware'

async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions to view audit logs
    // This should be replaced with proper permission checking
    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    
    // Parse query parameters
    const filters = {
      userId: searchParams.get('userId') || undefined,
      action: searchParams.get('action') || undefined,
      resource: searchParams.get('resource') || undefined,
      resourceId: searchParams.get('resourceId') || undefined,
      success: searchParams.get('success') ? searchParams.get('success') === 'true' : undefined,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100), // Max 100 per page
      search: searchParams.get('search') || undefined,
    }

    // Validate date range
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      )
    }

    const result = await AuditLogger.getAuditLogs(filters)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Wrap with audit logging
const wrappedGET = withAuditLogging(GET, {
  action: 'READ',
  resource: 'AUDIT_LOG',
})

export { wrappedGET as GET }
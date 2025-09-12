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

    // Check if user has admin permissions to export audit logs
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
      search: searchParams.get('search') || undefined,
      limit: 10000, // Export limit
    }

    const format = searchParams.get('format') || 'csv'

    if (format === 'csv') {
      const csvData = await AuditLogger.exportAuditLogs(filters)
      
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    } else {
      return NextResponse.json(
        { error: 'Unsupported export format' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error exporting audit logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Wrap with audit logging
const wrappedGET = withAuditLogging(GET, {
  action: 'EXPORT',
  resource: 'AUDIT_LOG',
})

export { wrappedGET as GET }
import { Metadata } from 'next'
import { AdminGuard } from '@/components/auth/admin-guard'
import { AuditLogViewer } from '@/components/audit/audit-log-viewer'

export const metadata: Metadata = {
  title: 'Audit Logs | Pekka HR',
  description: 'View and analyze system audit logs for security and compliance tracking',
}

export default function AuditLogsPage() {
  return (
    <AdminGuard>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Monitor and analyze system activities for security and compliance
          </p>
        </div>
        
        <AuditLogViewer />
      </div>
    </AdminGuard>
  )
}
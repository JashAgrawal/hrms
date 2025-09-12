import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentWorkflowManager } from '@/components/documents/document-workflow-manager'
import { DocumentSearchManager } from '@/components/documents/document-search-manager'
import { DocumentSecurityManager } from '@/components/documents/document-security-manager'
import { DocumentUpload } from '@/components/employees/document-upload'
import { 
  FileText, 
  Upload, 
  Search, 
  Shield, 
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users
} from 'lucide-react'

async function getDocumentStats(userId: string, userRole: string) {
  try {
    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true }
    })

    // Build where clause based on user role
    let whereClause: any = {}
    if (!['ADMIN', 'HR'].includes(userRole)) {
      // Non-admin users can only see their own documents
      whereClause.employeeId = user?.employee?.id
    }

    // Get document statistics
    const [
      totalDocuments,
      pendingApprovals,
      expiringDocuments,
      recentUploads,
      documentsByCategory,
      documentsByStatus
    ] = await Promise.all([
      prisma.document.count({ where: whereClause }),
      prisma.document.count({ 
        where: { 
          ...whereClause, 
          approvalStatus: 'PENDING' 
        } 
      }),
      prisma.document.count({
        where: {
          ...whereClause,
          expiryDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
          },
          status: 'ACTIVE'
        }
      }),
      prisma.document.count({
        where: {
          ...whereClause,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      prisma.document.groupBy({
        by: ['category'],
        where: whereClause,
        _count: true
      }),
      prisma.document.groupBy({
        by: ['status'],
        where: whereClause,
        _count: true
      })
    ])

    return {
      totalDocuments,
      pendingApprovals,
      expiringDocuments,
      recentUploads,
      documentsByCategory,
      documentsByStatus
    }
  } catch (error) {
    console.error('Error fetching document stats:', error)
    return {
      totalDocuments: 0,
      pendingApprovals: 0,
      expiringDocuments: 0,
      recentUploads: 0,
      documentsByCategory: [],
      documentsByStatus: []
    }
  }
}

async function getRecentDocuments(userId: string, userRole: string) {
  try {
    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true }
    })

    // Build where clause based on user role
    let whereClause: any = {}
    if (!['ADMIN', 'HR'].includes(userRole)) {
      whereClause.employeeId = user?.employee?.id
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        },
        approvals: {
          where: { status: 'PENDING' },
          orderBy: { level: 'asc' }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    })

    // Transform null values to undefined for component compatibility
    return documents.map(doc => ({
      ...doc,
      description: doc.description || undefined,
      originalName: doc.originalName || undefined,
      fileSize: doc.fileSize || undefined,
      mimeType: doc.mimeType || undefined,
      expiryDate: doc.expiryDate ? doc.expiryDate.toISOString() : undefined,
      tags: doc.tags ? (Array.isArray(doc.tags) ? doc.tags : JSON.parse(doc.tags as string)) : undefined,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      employee: doc.employee || undefined,
      versions: doc.versions.map(version => ({
        ...version,
        fileSize: version.fileSize || undefined,
        mimeType: version.mimeType || undefined,
        changeLog: version.changeLog || undefined,
        createdAt: version.createdAt.toISOString()
      })),
      approvals: doc.approvals.map(approval => ({
        ...approval,
        approverName: approval.approverName || undefined,
        approverEmail: approval.approverEmail || undefined,
        comments: approval.comments || undefined,
        createdAt: approval.createdAt.toISOString(),
        updatedAt: approval.updatedAt.toISOString(),
        approvedAt: approval.approvedAt ? approval.approvedAt.toISOString() : undefined,
        rejectedAt: approval.rejectedAt ? approval.rejectedAt.toISOString() : undefined,
        notificationSentAt: approval.notificationSentAt ? approval.notificationSentAt.toISOString() : undefined
      }))
    }))
  } catch (error) {
    console.error('Error fetching recent documents:', error)
    return []
  }
}

export default async function DocumentsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const [stats, recentDocuments] = await Promise.all([
    getDocumentStats(session.user.id, session.user.role),
    getRecentDocuments(session.user.id, session.user.role)
  ])

  const isAdminOrHR = ['ADMIN', 'HR'].includes(session.user.role)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Document Management</h1>
        <p className="text-muted-foreground">
          Manage documents with advanced workflows, security, and compliance features
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              Across all categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiringDocuments}</div>
            <p className="text-xs text-muted-foreground">
              Next 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Uploads</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentUploads}</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="workflow" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflow">Workflow Manager</TabsTrigger>
          <TabsTrigger value="search">Search & Organization</TabsTrigger>
          <TabsTrigger value="upload">Upload Documents</TabsTrigger>
          {isAdminOrHR && <TabsTrigger value="security">Security & Compliance</TabsTrigger>}
        </TabsList>

        <TabsContent value="workflow" className="space-y-4">
          <Suspense fallback={
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              </CardContent>
            </Card>
          }>
            <DocumentWorkflowManager 
              documents={recentDocuments}
              onDocumentUpdate={() => {
                // Refresh the page or refetch data
                window.location.reload()
              }}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Suspense fallback={
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              </CardContent>
            </Card>
          }>
            <DocumentSearchManager 
              documents={recentDocuments}
              showEmployeeFilter={isAdminOrHR}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Documents
              </CardTitle>
              <CardDescription>
                Upload new documents with automatic categorization and workflow routing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }>
                <DocumentUpload
                  employeeId={session.user.employeeId}
                  onDocumentsChange={() => {
                    // Refresh the page or refetch data
                    window.location.reload()
                  }}
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdminOrHR && (
          <TabsContent value="security" className="space-y-4">
            <Suspense fallback={
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                </CardContent>
              </Card>
            }>
              <DocumentSecurityManager 
                onSettingsUpdate={() => {
                  // Refresh the page or refetch data
                  window.location.reload()
                }}
              />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>

      {/* Quick Stats */}
      {stats.documentsByCategory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Documents by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.documentsByCategory.map((item) => (
                  <div key={item.category} className="flex justify-between items-center">
                    <span className="text-sm">{item.category}</span>
                    <span className="font-semibold">{item._count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Documents by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.documentsByStatus.map((item) => (
                  <div key={item.status} className="flex justify-between items-center">
                    <span className="text-sm">{item.status}</span>
                    <span className="font-semibold">{item._count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
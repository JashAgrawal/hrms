import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentWorkflowWrapper } from '@/components/documents/document-workflow-wrapper'
import { DocumentSearchWrapper } from '@/components/documents/document-search-wrapper'
import { DocumentSecurityWrapper } from '@/components/documents/document-security-wrapper'
import { DocumentUploadWrapper } from '@/components/employees/document-upload-wrapper'
import { 
  FileText, 
  Upload, 
  Search, 
  Shield, 
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Building2
} from 'lucide-react'

async function getCompanyDocumentStats(userRole: string) {
  try {
    // Only admin/HR can access company documents
    if (!['ADMIN', 'HR'].includes(userRole)) {
      return null
    }

    // Get company-wide document statistics
    const [
      totalDocuments,
      pendingApprovals,
      expiringDocuments,
      recentUploads,
      documentsByCategory,
      documentsByStatus
    ] = await Promise.all([
      prisma.document.count({
        where: {
          OR: [
            { employeeId: null }, // Company-wide documents
            { category: { in: ['PROFESSIONAL', 'OTHER', 'COMPLIANCE', 'LEGAL'] } }
          ]
        }
      }),
      prisma.document.count({ 
        where: { 
          approvalStatus: 'PENDING',
          OR: [
            { employeeId: null },
            { category: { in: ['PROFESSIONAL', 'OTHER', 'COMPLIANCE', 'LEGAL'] } }
          ]
        } 
      }),
      prisma.document.count({
        where: {
          expiryDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
          },
          status: 'ACTIVE',
          OR: [
            { employeeId: null },
            { category: { in: ['PROFESSIONAL', 'OTHER', 'COMPLIANCE', 'LEGAL'] } }
          ]
        }
      }),
      prisma.document.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          },
          OR: [
            { employeeId: null },
            { category: { in: ['PROFESSIONAL', 'OTHER', 'COMPLIANCE', 'LEGAL'] } }
          ]
        }
      }),
      prisma.document.groupBy({
        by: ['category'],
        where: {
          OR: [
            { employeeId: null },
            { category: { in: ['PROFESSIONAL', 'OTHER', 'COMPLIANCE', 'LEGAL'] } }
          ]
        },
        _count: true
      }),
      prisma.document.groupBy({
        by: ['status'],
        where: {
          OR: [
            { employeeId: null },
            { category: { in: ['PROFESSIONAL', 'OTHER', 'COMPLIANCE', 'LEGAL'] } }
          ]
        },
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
    console.error('Error fetching company document stats:', error)
    return null
  }
}

async function getCompanyDocuments(userRole: string) {
  try {
    // Only admin/HR can access company documents
    if (!['ADMIN', 'HR'].includes(userRole)) {
      return []
    }

    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { employeeId: null }, // Company-wide documents
          { category: { in: ['PROFESSIONAL', 'OTHER', 'COMPLIANCE', 'LEGAL'] } }
        ]
      },
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
      take: 50
    })

    return documents.map(doc => ({
      ...doc,
      employee: doc.employee || null,
      versions: doc.versions || [],
      approvals: doc.approvals || []
    }))
  } catch (error) {
    console.error('Error fetching company documents:', error)
    return []
  }
}

export default async function CompanyDocumentsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Check if user has permission to access company documents
  if (!['ADMIN', 'HR'].includes(session.user.role)) {
    redirect('/dashboard/documents')
  }

  const [stats, companyDocuments] = await Promise.all([
    getCompanyDocumentStats(session.user.role),
    getCompanyDocuments(session.user.role)
  ])

  if (!stats) {
    redirect('/dashboard/documents')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Company Documents</h1>
        <p className="text-muted-foreground">
          Manage company-wide documents, policies, and compliance materials
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              Company-wide documents
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
          <TabsTrigger value="workflow">Document Management</TabsTrigger>
          <TabsTrigger value="search">Search & Organization</TabsTrigger>
          <TabsTrigger value="upload">Upload Company Documents</TabsTrigger>
          <TabsTrigger value="security">Security & Compliance</TabsTrigger>
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
            <DocumentWorkflowWrapper
              documents={companyDocuments}
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
            <DocumentSearchWrapper
              documents={companyDocuments}
              showEmployeeFilter={false}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Company Documents
              </CardTitle>
              <CardDescription>
                Upload company-wide documents, policies, and compliance materials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }>
                <DocumentUploadWrapper
                  employeeId={null} // Company documents don't belong to specific employees
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

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
            <DocumentSecurityWrapper />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

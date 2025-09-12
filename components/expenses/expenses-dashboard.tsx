'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ExpenseClaimForm } from './expense-claim-form'
import { ExpenseClaimList } from './expense-claim-list'
import { ExpenseClaimDetails } from './expense-claim-details'
import { ExpenseApprovalManager } from './expense-approval-manager'
import { PetrolExpensePreview } from './petrol-expense-preview'
import { ReimbursementDashboard } from './reimbursement-dashboard'
import { ExpenseAuditTrail } from './expense-audit-trail'
import { 
  Plus,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  Car,
  Users,
  Calendar,
  AlertTriangle
} from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

interface ExpenseSummary {
  totalClaims: number
  totalAmount: number
  pendingClaims: number
  pendingAmount: number
  approvedClaims: number
  approvedAmount: number
  rejectedClaims: number
  reimbursedAmount: number
}

interface ExpenseClaim {
  id: string
  title: string
  description?: string
  amount: number
  expenseDate: Date
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'CANCELLED'
  merchantName?: string
  billNumber?: string
  location?: {
    latitude: number
    longitude: number
    address?: string
  }
  policyViolations?: Array<{
    rule: string
    message: string
  }>
  category: {
    id: string
    name: string
    code: string
    maxAmount?: number
    requiresReceipt: boolean
    requiresApproval: boolean
  }
  employee?: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    email: string
  }
  attachments: Array<{
    id: string
    fileName: string
    fileType: string
    fileSize: number
    fileUrl?: string
  }>
  approvals: Array<{
    id: string
    level: number
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    approverName: string
    approverEmail?: string
    approvedAt?: Date
    comments?: string
  }>
  travelRequest?: {
    id: string
    title: string
    destination: string
  }
  createdAt: Date
  updatedAt: Date
}

export function ExpensesDashboard() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('my-expenses')
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null)
  const [loading, setSummaryLoading] = useState(true)

  // Determine user role and permissions
  const userRole = session?.user?.role || 'EMPLOYEE'
  const canApprove = ['ADMIN', 'HR', 'MANAGER', 'FINANCE'].includes(userRole)
  const canProcessReimbursements = ['ADMIN', 'FINANCE', 'HR'].includes(userRole)
  const canViewAudit = ['ADMIN', 'FINANCE', 'HR'].includes(userRole)
  const isFieldEmployee = false // TODO: Add employee type to session

  // Fetch expense summary
  const fetchSummary = async () => {
    setSummaryLoading(true)
    try {
      const currentMonth = new Date()
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

      const response = await fetch(`/api/expenses/summary?startDate=${startDate}&endDate=${endDate}`)
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      }
    } catch (error) {
      console.error('Error fetching expense summary:', error)
    } finally {
      setSummaryLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  // Handle form submission
  const handleCreateExpense = async (data: any, attachments: any[]) => {
    try {
      // Create expense claim
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const expenseClaim = await response.json()

        // Upload attachments if any
        if (attachments.length > 0) {
          const formData = new FormData()
          attachments.forEach((attachment, index) => {
            formData.append(`files`, attachment.file)
          })

          await fetch(`/api/expenses/${expenseClaim.id}/attachments`, {
            method: 'POST',
            body: formData,
          })
        }

        setShowCreateForm(false)
        await fetchSummary()
        alert('Expense claim submitted successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create expense claim')
      }
    } catch (error) {
      console.error('Error creating expense claim:', error)
      alert('Error creating expense claim')
    }
  }

  // Handle edit expense
  const handleEditExpense = (claim: ExpenseClaim) => {
    setSelectedClaim(claim)
    setShowEditForm(true)
  }

  // Handle view details
  const handleViewDetails = (claim: ExpenseClaim) => {
    setSelectedClaim(claim)
    setShowDetailsDialog(true)
  }

  // Handle delete expense
  const handleDeleteExpense = async (claimId: string) => {
    await fetchSummary()
  }

  // Handle approval actions
  const handleApproval = async (claimId: string, action: 'approve' | 'reject', comments?: string) => {
    try {
      const response = await fetch(`/api/expenses/${claimId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action.toUpperCase(),
          comments,
        }),
      })

      if (response.ok) {
        setShowDetailsDialog(false)
        setSelectedClaim(null)
        await fetchSummary()
        alert(`Expense claim ${action}d successfully!`)
      } else {
        const error = await response.json()
        alert(error.error || `Failed to ${action} expense claim`)
      }
    } catch (error) {
      console.error(`Error ${action}ing expense claim:`, error)
      alert(`Error ${action}ing expense claim`)
    }
  }

  // Determine available tabs based on user role
  const availableTabs = [
    { id: 'my-expenses', label: 'My Expenses', icon: Receipt },
    ...(isFieldEmployee ? [{ id: 'petrol-expenses', label: 'Petrol Expenses', icon: Car }] : []),
    ...(canApprove ? [{ id: 'approvals', label: 'Approvals', icon: CheckCircle }] : []),
    ...(canProcessReimbursements ? [{ id: 'reimbursements', label: 'Reimbursements', icon: DollarSign }] : []),
    ...(canViewAudit ? [{ id: 'audit', label: 'Audit & Compliance', icon: AlertTriangle }] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">
            Manage your expense claims and reimbursements
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Expense Claim
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Claims</p>
                  <p className="text-2xl font-bold">{summary.totalClaims}</p>
                  <p className="text-xs text-muted-foreground">
                    ₹{summary.totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Pending</p>
                  <p className="text-2xl font-bold">{summary.pendingClaims}</p>
                  <p className="text-xs text-muted-foreground">
                    ₹{summary.pendingAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Approved</p>
                  <p className="text-2xl font-bold">{summary.approvedClaims}</p>
                  <p className="text-xs text-muted-foreground">
                    ₹{summary.approvedAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Reimbursed</p>
                  <p className="text-2xl font-bold">₹{summary.reimbursedAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    This month
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${availableTabs.length <= 3 ? 'grid-cols-3' : availableTabs.length <= 4 ? 'grid-cols-4' : 'grid-cols-5'}`}>
          {availableTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center space-x-2">
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="my-expenses" className="space-y-6">
          <ExpenseClaimList
            onCreateNew={() => setShowCreateForm(true)}
            onEdit={handleEditExpense}
            onView={handleViewDetails}
            onDelete={handleDeleteExpense}
          />
        </TabsContent>

        {isFieldEmployee && (
          <TabsContent value="petrol-expenses" className="space-y-6">
            <PetrolExpensePreview
              onGenerateExpense={(monthlyExpenseId) => {
                alert('Monthly petrol expense generated successfully!')
                fetchSummary()
              }}
            />
          </TabsContent>
        )}

        {canApprove && (
          <TabsContent value="approvals" className="space-y-6">
            <ExpenseApprovalManager
              onViewDetails={handleViewDetails}
            />
          </TabsContent>
        )}

        {canProcessReimbursements && (
          <TabsContent value="reimbursements" className="space-y-6">
            <ReimbursementDashboard />
          </TabsContent>
        )}

        {canViewAudit && (
          <TabsContent value="audit" className="space-y-6">
            <ExpenseAuditTrail />
          </TabsContent>
        )}
      </Tabs>

      {/* Create Expense Form Dialog */}
      {showCreateForm && (
        <Dialog open={true} onOpenChange={setShowCreateForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <ExpenseClaimForm
              onSubmit={handleCreateExpense}
              onCancel={() => setShowCreateForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Expense Form Dialog */}
      {showEditForm && selectedClaim && (
        <Dialog open={true} onOpenChange={setShowEditForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <ExpenseClaimForm
              onSubmit={async (data, attachments) => {
                // Handle edit logic here
                setShowEditForm(false)
                await fetchSummary()
              }}
              onCancel={() => setShowEditForm(false)}
              initialData={{
                categoryId: selectedClaim.category.id,
                title: selectedClaim.title,
                description: selectedClaim.description,
                amount: selectedClaim.amount,
                expenseDate: new Date(selectedClaim.expenseDate),
                merchantName: selectedClaim.merchantName,
                billNumber: selectedClaim.billNumber,
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Expense Details Dialog */}
      {showDetailsDialog && selectedClaim && (
        <Dialog open={true} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <ExpenseClaimDetails
              claim={selectedClaim}
              onClose={() => setShowDetailsDialog(false)}
              onEdit={() => {
                setShowDetailsDialog(false)
                handleEditExpense(selectedClaim)
              }}
              onApprove={(comments) => handleApproval(selectedClaim.id, 'approve', comments)}
              onReject={(comments) => handleApproval(selectedClaim.id, 'reject', comments)}
              canApprove={canApprove && selectedClaim.status === 'PENDING'}
              canEdit={selectedClaim.status === 'PENDING'}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
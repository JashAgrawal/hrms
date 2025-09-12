'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  TravelRequestForm, 
  TravelRequestList, 
  TravelApprovalDialog 
} from '@/components/travel'
import { 
  Plus, 
  Plane, 
  Clock, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Calendar,
  TrendingUp
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface TravelRequest {
  id: string
  title: string
  purpose: string
  destination: string
  fromLocation: string
  startDate: string
  endDate: string
  estimatedCost: number
  actualCost?: number
  travelMode: 'FLIGHT' | 'TRAIN' | 'BUS' | 'CAR' | 'TAXI' | 'OTHER'
  accommodationRequired: boolean
  advanceRequired: boolean
  advanceAmount?: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
  }
  approvals: Array<{
    id: string
    level: number
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    approverName?: string
  }>
  expenseClaims: Array<{
    id: string
    title: string
    amount: number
    status: string
  }>
}

export default function TravelPage() {
  const [activeTab, setActiveTab] = useState('my-requests')
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<TravelRequest | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Mock stats - in real app, fetch from API
  const stats = {
    totalRequests: 12,
    pendingApproval: 3,
    approved: 7,
    thisMonthSpend: 125000,
  }

  const handleCreateRequest = async (data: any) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/travel-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: 'Travel request submitted',
          description: 'Your travel request has been submitted for approval.',
        })
        setShowNewRequestDialog(false)
        // Refresh the list
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to submit travel request',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit travel request',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveRequest = async (requestId: string, action: 'APPROVE' | 'REJECT', comments?: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/travel-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, comments }),
      })

      if (response.ok) {
        toast({
          title: `Request ${action.toLowerCase()}d`,
          description: `Travel request has been ${action.toLowerCase()}d successfully.`,
        })
        setShowApprovalDialog(false)
        // Refresh the list
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || `Failed to ${action.toLowerCase()} request`,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${action.toLowerCase()} request`,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewRequest = (request: TravelRequest) => {
    setSelectedRequest(request)
    // Could open a detailed view dialog
  }

  const handleEditRequest = (request: TravelRequest) => {
    setSelectedRequest(request)
    setShowNewRequestDialog(true)
  }

  const handleDeleteRequest = async (request: TravelRequest) => {
    if (!confirm('Are you sure you want to cancel this travel request?')) return

    try {
      const response = await fetch(`/api/travel-requests/${request.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Request cancelled',
          description: 'Travel request has been cancelled successfully.',
        })
        // Refresh the list
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to cancel request',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel request',
        variant: 'destructive',
      })
    }
  }

  const handleApprovalAction = (request: TravelRequest) => {
    setSelectedRequest(request)
    setShowApprovalDialog(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Travel Management</h1>
          <p className="text-muted-foreground">
            Manage travel requests, approvals, and expense claims
          </p>
        </div>
        <Dialog open={showNewRequestDialog} onOpenChange={setShowNewRequestDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Travel Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Travel Request</DialogTitle>
              <DialogDescription>
                Submit a new travel request with detailed itinerary and cost estimation
              </DialogDescription>
            </DialogHeader>
            <TravelRequestForm
              onSubmit={handleCreateRequest}
              onCancel={() => setShowNewRequestDialog(false)}
              isLoading={isLoading}
              initialData={selectedRequest ? {
                title: selectedRequest.title,
                purpose: selectedRequest.purpose,
                destination: selectedRequest.destination,
                fromLocation: selectedRequest.fromLocation,
                startDate: new Date(selectedRequest.startDate),
                endDate: new Date(selectedRequest.endDate),
                estimatedCost: selectedRequest.estimatedCost,
                travelMode: selectedRequest.travelMode,
                accommodationRequired: selectedRequest.accommodationRequired,
                advanceRequired: selectedRequest.advanceRequired,
                advanceAmount: selectedRequest.advanceAmount,
              } : undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              This year
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingApproval}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">
              Ready to travel
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.thisMonthSpend.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="my-requests">My Requests</TabsTrigger>
          <TabsTrigger value="team-requests">Team Requests</TabsTrigger>
          <TabsTrigger value="approvals">Pending Approvals</TabsTrigger>
          <TabsTrigger value="all-requests">All Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="my-requests" className="space-y-4">
          <TravelRequestList
            onView={handleViewRequest}
            onEdit={handleEditRequest}
            onDelete={handleDeleteRequest}
            showEmployeeColumn={false}
          />
        </TabsContent>

        <TabsContent value="team-requests" className="space-y-4">
          <TravelRequestList
            onView={handleViewRequest}
            onApprove={handleApprovalAction}
            showEmployeeColumn={true}
          />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <TravelRequestList
            onView={handleViewRequest}
            onApprove={handleApprovalAction}
            showEmployeeColumn={true}
          />
        </TabsContent>

        <TabsContent value="all-requests" className="space-y-4">
          <TravelRequestList
            onView={handleViewRequest}
            onEdit={handleEditRequest}
            onDelete={handleDeleteRequest}
            onApprove={handleApprovalAction}
            showEmployeeColumn={true}
          />
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <TravelApprovalDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        travelRequest={selectedRequest}
        onApprove={handleApproveRequest}
        isLoading={isLoading}
      />
    </div>
  )
}
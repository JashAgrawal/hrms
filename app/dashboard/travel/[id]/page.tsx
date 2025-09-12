'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TravelExpenseTracker } from '@/components/travel'
import { ExpenseClaimForm } from '@/components/expenses'
import { 
  ArrowLeft,
  Plane,
  Train,
  Bus,
  Car,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Building,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit,
  Plus
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
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
  itinerary?: Array<{
    date: string
    location: string
    activity: string
    estimatedCost?: number
    notes?: string
  }>
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    department?: {
      name: string
    }
  }
  approvals: Array<{
    id: string
    level: number
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    approverName?: string
    comments?: string
    approvedAt?: string
    rejectedAt?: string
  }>
  expenseClaims: Array<{
    id: string
    title: string
    amount: number
    status: string
    expenseDate: string
  }>
}

const travelModeIcons = {
  FLIGHT: Plane,
  TRAIN: Train,
  BUS: Bus,
  CAR: Car,
  TAXI: Car,
  OTHER: MapPin,
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
  COMPLETED: 'bg-blue-100 text-blue-800 border-blue-200',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
}

const approvalStatusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
}

export default function TravelRequestDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [travelRequest, setTravelRequest] = useState<TravelRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)

  const fetchTravelRequest = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/travel-requests/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setTravelRequest(data)
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch travel request details',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching travel request:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch travel request details',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (params.id) {
      fetchTravelRequest()
    }
  }, [params.id])

  const handleCreateExpense = async (expenseData: any) => {
    setIsSubmittingExpense(true)
    try {
      const response = await fetch(`/api/travel-requests/${params.id}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData),
      })

      if (response.ok) {
        toast({
          title: 'Expense created',
          description: 'Travel expense has been submitted successfully.',
        })
        setShowExpenseForm(false)
        // Refresh travel request data
        fetchTravelRequest()
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to create expense',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create expense',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingExpense(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading travel request details...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!travelRequest) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              Travel request not found
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const TravelIcon = travelModeIcons[travelRequest.travelMode]
  const tripDuration = Math.ceil(
    (new Date(travelRequest.endDate).getTime() - new Date(travelRequest.startDate).getTime()) / 
    (1000 * 60 * 60 * 24)
  )

  const canAddExpenses = travelRequest.status === 'APPROVED' || travelRequest.status === 'COMPLETED'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{travelRequest.title}</h1>
            <p className="text-muted-foreground">{travelRequest.purpose}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("border", statusColors[travelRequest.status])}>
            {travelRequest.status.charAt(0) + travelRequest.status.slice(1).toLowerCase()}
          </Badge>
          {travelRequest.status === 'PENDING' && (
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Travel Request Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TravelIcon className="h-5 w-5" />
            Travel Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Employee:</span>
                <span>
                  {travelRequest.employee.firstName} {travelRequest.employee.lastName}
                  ({travelRequest.employee.employeeCode})
                </span>
              </div>
              {travelRequest.employee.department && (
                <div className="flex items-center gap-2 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Department:</span>
                  <span>{travelRequest.employee.department.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Route:</span>
                <span>{travelRequest.fromLocation} → {travelRequest.destination}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TravelIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Mode:</span>
                <span>{travelRequest.travelMode.charAt(0) + travelRequest.travelMode.slice(1).toLowerCase()}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Travel Dates</div>
                  <div>
                    {format(new Date(travelRequest.startDate), 'MMM dd, yyyy')} - {' '}
                    {format(new Date(travelRequest.endDate), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-muted-foreground">({tripDuration} days)</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Cost</div>
                  <div className="text-lg font-semibold">
                    Estimated: ₹{travelRequest.estimatedCost.toLocaleString()}
                  </div>
                  {travelRequest.actualCost && (
                    <div className="text-sm text-muted-foreground">
                      Actual: ₹{travelRequest.actualCost.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Accommodation:</span>
                  <Badge variant={travelRequest.accommodationRequired ? "default" : "secondary"}>
                    {travelRequest.accommodationRequired ? 'Required' : 'Not Required'}
                  </Badge>
                </div>
                {travelRequest.advanceRequired && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Advance:</span>
                    <Badge variant="outline">
                      ₹{travelRequest.advanceAmount?.toLocaleString()}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Details and Expenses */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details & Approvals</TabsTrigger>
          <TabsTrigger value="expenses">
            Expenses ({travelRequest.expenseClaims.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {/* Itinerary */}
          {travelRequest.itinerary && travelRequest.itinerary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Itinerary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {travelRequest.itinerary.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Day {index + 1}</h4>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(item.date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Location:</span> {item.location}
                        </div>
                        <div>
                          <span className="font-medium">Activity:</span> {item.activity}
                        </div>
                        {item.estimatedCost && (
                          <div>
                            <span className="font-medium">Cost:</span> ₹{item.estimatedCost.toLocaleString()}
                          </div>
                        )}
                      </div>
                      {item.notes && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <span className="font-medium">Notes:</span> {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval History */}
          <Card>
            <CardHeader>
              <CardTitle>Approval Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {travelRequest.approvals.map((approval) => (
                  <div key={approval.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-shrink-0">
                      {approval.status === 'APPROVED' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : approval.status === 'REJECTED' ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Level {approval.level}</span>
                        <Badge className={cn("border", approvalStatusColors[approval.status])}>
                          {approval.status.charAt(0) + approval.status.slice(1).toLowerCase()}
                        </Badge>
                      </div>
                      {approval.approverName && (
                        <div className="text-sm text-muted-foreground">
                          {approval.approverName}
                        </div>
                      )}
                      {approval.comments && (
                        <div className="text-sm mt-1">
                          <span className="font-medium">Comments:</span> {approval.comments}
                        </div>
                      )}
                      {(approval.approvedAt || approval.rejectedAt) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {approval.approvedAt 
                            ? `Approved on ${format(new Date(approval.approvedAt), 'MMM dd, yyyy HH:mm')}`
                            : `Rejected on ${format(new Date(approval.rejectedAt!), 'MMM dd, yyyy HH:mm')}`
                          }
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Travel Expenses</h3>
              <p className="text-sm text-muted-foreground">
                Track and manage expenses for this travel request
              </p>
            </div>
            {canAddExpenses && (
              <Button onClick={() => setShowExpenseForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            )}
          </div>

          <TravelExpenseTracker 
            travelRequestId={travelRequest.id}
            onAddExpense={canAddExpenses ? () => setShowExpenseForm(true) : undefined}
          />
        </TabsContent>
      </Tabs>

      {/* Add Expense Dialog */}
      <Dialog open={showExpenseForm} onOpenChange={setShowExpenseForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Travel Expense</DialogTitle>
            <DialogDescription>
              Create an expense claim for this travel request
            </DialogDescription>
          </DialogHeader>
          <ExpenseClaimForm
            onSubmit={handleCreateExpense}
            onCancel={() => setShowExpenseForm(false)}
            isLoading={isSubmittingExpense}
            initialData={{
              expenseDate: new Date(),
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
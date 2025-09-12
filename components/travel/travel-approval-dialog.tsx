'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Calendar,
  DollarSign,
  Plane,
  Train,
  Bus,
  Car,
  User,
  Building
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const approvalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional(),
})

type ApprovalFormData = z.infer<typeof approvalSchema>

interface TravelRequest {
  id: string
  title: string
  purpose: string
  destination: string
  fromLocation: string
  startDate: string
  endDate: string
  estimatedCost: number
  travelMode: 'FLIGHT' | 'TRAIN' | 'BUS' | 'CAR' | 'TAXI' | 'OTHER'
  accommodationRequired: boolean
  advanceRequired: boolean
  advanceAmount?: number
  status: string
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
}

interface TravelApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  travelRequest: TravelRequest | null
  onApprove: (requestId: string, action: 'APPROVE' | 'REJECT', comments?: string) => Promise<void>
  isLoading?: boolean
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
}

export function TravelApprovalDialog({
  open,
  onOpenChange,
  travelRequest,
  onApprove,
  isLoading = false,
}: TravelApprovalDialogProps) {
  const [selectedAction, setSelectedAction] = useState<'APPROVE' | 'REJECT' | null>(null)

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
      comments: '',
    },
  })

  const handleSubmit = async (data: ApprovalFormData) => {
    if (!travelRequest || !selectedAction) return

    await onApprove(travelRequest.id, selectedAction, data.comments)
    onOpenChange(false)
    form.reset()
    setSelectedAction(null)
  }

  if (!travelRequest) return null

  const TravelIcon = travelModeIcons[travelRequest.travelMode]
  const tripDuration = Math.ceil(
    (new Date(travelRequest.endDate).getTime() - new Date(travelRequest.startDate).getTime()) / 
    (1000 * 60 * 60 * 24)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TravelIcon className="h-5 w-5" />
            Travel Request Approval
          </DialogTitle>
          <DialogDescription>
            Review and approve or reject this travel request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{travelRequest.title}</CardTitle>
              <CardDescription>{travelRequest.purpose}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
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
                </div>

                <div className="space-y-2">
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
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <div className="font-medium">Estimated Cost</div>
                    <div className="text-lg font-semibold">₹{travelRequest.estimatedCost.toLocaleString()}</div>
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
            </CardContent>
          </Card>

          {/* Itinerary */}
          {travelRequest.itinerary && travelRequest.itinerary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Itinerary</CardTitle>
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
              <CardTitle className="text-lg">Approval Workflow</CardTitle>
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
                        <Badge className={cn("border", statusColors[approval.status])}>
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

          {/* Approval Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Decision</CardTitle>
              <CardDescription>
                Choose to approve or reject this travel request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant={selectedAction === 'APPROVE' ? 'default' : 'outline'}
                      className={cn(
                        "flex-1",
                        selectedAction === 'APPROVE' && "bg-green-600 hover:bg-green-700"
                      )}
                      onClick={() => {
                        setSelectedAction('APPROVE')
                        form.setValue('action', 'APPROVE')
                      }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve Request
                    </Button>
                    <Button
                      type="button"
                      variant={selectedAction === 'REJECT' ? 'destructive' : 'outline'}
                      className="flex-1"
                      onClick={() => {
                        setSelectedAction('REJECT')
                        form.setValue('action', 'REJECT')
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject Request
                    </Button>
                  </div>

                  {selectedAction && (
                    <FormField
                      control={form.control}
                      name="comments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Comments {selectedAction === 'REJECT' && '(Required for rejection)'}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={
                                selectedAction === 'APPROVE'
                                  ? 'Optional comments for approval...'
                                  : 'Please provide reason for rejection...'
                              }
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!selectedAction || isLoading}
                    >
                      {isLoading ? 'Processing...' : `${selectedAction?.charAt(0)}${selectedAction?.slice(1).toLowerCase()} Request`}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
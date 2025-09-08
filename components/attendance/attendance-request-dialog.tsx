'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { MapPin, Clock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

interface LocationDetails {
  name: string
  address?: string
  distance: number
  allowedRadius: number
}

interface AttendanceRequestDialogProps {
  isOpen: boolean
  onClose: () => void
  location: {
    latitude: number
    longitude: number
    accuracy?: number
  }
  nearestLocation?: LocationDetails
  onSuccess?: () => void
}

export function AttendanceRequestDialog({
  isOpen,
  onClose,
  location,
  nearestLocation,
  onSuccess
}: AttendanceRequestDialogProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the out-of-location check-in",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)
      
      const response = await fetch('/api/attendance/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: new Date().toISOString(),
          checkInTime: new Date().toISOString(),
          location,
          reason: reason.trim(),
        }),
      })

      if (response.ok) {
        toast({
          title: "Request Submitted",
          description: "Your attendance request has been submitted for approval",
        })
        setReason('')
        onClose()
        onSuccess?.()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit attendance request')
      }
    } catch (error) {
      console.error('Error submitting attendance request:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit attendance request",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Out of Location Check-in
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-orange-900">
                    You are not within any assigned work location
                  </p>
                  
                  {nearestLocation && (
                    <div className="text-xs text-orange-800 space-y-1">
                      <p><strong>Nearest Location:</strong> {nearestLocation.name}</p>
                      {nearestLocation.address && (
                        <p><strong>Address:</strong> {nearestLocation.address}</p>
                      )}
                      <p>
                        <strong>Distance:</strong> {nearestLocation.distance}m away 
                        (allowed: {nearestLocation.allowedRadius}m)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for Out-of-Location Check-in <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you need to check in from this location (e.g., client meeting, emergency, field work, etc.)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              Your request will be sent to your manager for approval
            </p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3 w-3" />
              <span className="font-medium">Request Details</span>
            </div>
            <p>Date: {format(new Date(), 'MMM dd, yyyy')}</p>
            <p>Time: {format(new Date(), 'HH:mm:ss')}</p>
            <p>Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
            {location.accuracy && (
              <p>Accuracy: ±{Math.round(location.accuracy)}m</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !reason.trim()}
              className="flex-1"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
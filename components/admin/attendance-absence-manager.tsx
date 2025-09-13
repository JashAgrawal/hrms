'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Calendar, Clock, Users, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'

interface PreviewData {
  totalRecords: number
  eligibleForMarking: number
  alreadyProcessed: number
  employees: Array<{
    employeeCode: string
    employeeName: string
    checkInTime: string
    currentStatus: string
  }>
}

interface ProcessResult {
  success: boolean
  processed: number
  summary: {
    totalRecordsFound: number
    successful: number
    failed: number
    skipped: number
  }
  processedEmployees: Array<{
    employeeId: string
    employeeCode: string
    employeeName: string
    checkInTime: string
    previousStatus: string
  }>
  errors: Array<{
    employeeId: string
    error: string
  }>
}

export function AttendanceAbsenceManager() {
  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null)
  const [targetDate, setTargetDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [singleEmployeeId, setSingleEmployeeId] = useState('')
  const [reason, setReason] = useState('')

  const handlePreview = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/attendance/mark-absent?targetDate=${targetDate}T00:00:00.000Z`)
      const data = await response.json()

      if (response.ok) {
        setPreviewData(data)
        setProcessResult(null)
        toast.success(`Preview loaded: ${data.eligibleForMarking} employees eligible for absence marking`)
      } else {
        toast.error(data.error || 'Failed to load preview')
      }
    } catch (error) {
      toast.error('Failed to load preview')
      console.error('Preview error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkProcess = async () => {
    if (!previewData || previewData.eligibleForMarking === 0) {
      toast.error('No employees eligible for processing')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/attendance/mark-absent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetDate: `${targetDate}T00:00:00.000Z`,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setProcessResult(data)
        setPreviewData(null)
        toast.success(data.message || 'Bulk processing completed')
      } else {
        toast.error(data.error || 'Failed to process attendance records')
      }
    } catch (error) {
      toast.error('Failed to process attendance records')
      console.error('Process error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSingleEmployeeProcess = async () => {
    if (!singleEmployeeId.trim()) {
      toast.error('Please enter an employee ID')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/attendance/mark-absent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetDate: `${targetDate}T00:00:00.000Z`,
          employeeId: singleEmployeeId.trim(),
          reason: reason.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Employee processed successfully')
        setSingleEmployeeId('')
        setReason('')
      } else {
        toast.error(data.message || 'Failed to process employee')
      }
    } catch (error) {
      toast.error('Failed to process employee')
      console.error('Single employee process error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance Absence Manager
          </CardTitle>
          <CardDescription>
            Automatically mark employees as absent if they haven't checked out by 12 PM (end of day)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="targetDate">Target Date</Label>
            <Input
              id="targetDate"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Preview Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button onClick={handlePreview} disabled={loading} variant="outline">
                <Users className="h-4 w-4 mr-2" />
                {loading ? 'Loading...' : 'Preview Eligible Employees'}
              </Button>
            </div>

            {previewData && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium">Preview Results for {format(new Date(targetDate), 'PPP')}</div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Total Records:</span> {previewData.totalRecords}
                      </div>
                      <div>
                        <span className="font-medium">Eligible for Marking:</span> 
                        <Badge variant="destructive" className="ml-1">{previewData.eligibleForMarking}</Badge>
                      </div>
                      <div>
                        <span className="font-medium">Already Processed:</span> {previewData.alreadyProcessed}
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {previewData && previewData.employees.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Employees to be marked absent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {previewData.employees.map((employee, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">{employee.employeeCode}</span> - {employee.employeeName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Check-in: {employee.checkInTime} | Status: {employee.currentStatus}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {previewData && previewData.eligibleForMarking > 0 && (
              <Button onClick={handleBulkProcess} disabled={loading} variant="destructive">
                <AlertTriangle className="h-4 w-4 mr-2" />
                {loading ? 'Processing...' : `Mark ${previewData.eligibleForMarking} Employees as Absent`}
              </Button>
            )}
          </div>

          <Separator />

          {/* Single Employee Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Mark Single Employee</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  placeholder="Enter employee ID"
                  value={singleEmployeeId}
                  onChange={(e) => setSingleEmployeeId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Custom reason for marking absent"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <Button onClick={handleSingleEmployeeProcess} disabled={loading} variant="outline">
              <XCircle className="h-4 w-4 mr-2" />
              {loading ? 'Processing...' : 'Mark Employee as Absent'}
            </Button>
          </div>

          {/* Results Section */}
          {processResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {processResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  Processing Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Total Found:</span> {processResult.summary.totalRecordsFound}
                  </div>
                  <div>
                    <span className="font-medium">Successful:</span> 
                    <Badge variant="default" className="ml-1">{processResult.summary.successful}</Badge>
                  </div>
                  <div>
                    <span className="font-medium">Failed:</span> 
                    <Badge variant="destructive" className="ml-1">{processResult.summary.failed}</Badge>
                  </div>
                  <div>
                    <span className="font-medium">Skipped:</span> {processResult.summary.skipped}
                  </div>
                </div>

                {processResult.processedEmployees.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Successfully Processed Employees:</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {processResult.processedEmployees.map((employee, index) => (
                        <div key={index} className="text-sm p-2 bg-green-50 rounded">
                          <span className="font-medium">{employee.employeeCode}</span> - {employee.employeeName}
                          <div className="text-xs text-muted-foreground">
                            Check-in: {employee.checkInTime} | Previous Status: {employee.previousStatus}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {processResult.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-red-600">Errors:</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {processResult.errors.map((error, index) => (
                        <div key={index} className="text-sm p-2 bg-red-50 rounded">
                          Employee ID: {error.employeeId} - {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Download, 
  FileText, 
  Calendar,
  Eye,
  Loader2,
  AlertTriangle
} from 'lucide-react'

interface Payslip {
  id: string
  fileName: string
  fileSize: number
  generatedAt: string
  accessedAt?: string
  downloadCount: number
  status: string
  emailSent: boolean
  emailSentAt?: string
  payrollRun: {
    period: string
    startDate: string
    endDate: string
    status: string
  }
}

interface EmployeePayslipsProps {
  onViewPayslip?: (payslipId: string) => void
}

export default function EmployeePayslips({ onViewPayslip }: EmployeePayslipsProps) {
  const { data: session } = useSession()
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPayslips()
  }, [])

  const fetchPayslips = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/payroll/my-payslips')
      if (response.ok) {
        const data = await response.json()
        setPayslips(data.payslips)
      } else {
        setError('Failed to fetch payslips')
      }
    } catch (error) {
      console.error('Error fetching payslips:', error)
      setError('An error occurred while fetching payslips')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (period: string, fileName: string) => {
    try {
      setDownloadingId(period)
      const response = await fetch(`/api/payroll/my-payslips?period=${period}&download=true`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        // Refresh payslips to update download count
        fetchPayslips()
      } else {
        setError('Failed to download payslip')
      }
    } catch (error) {
      console.error('Error downloading payslip:', error)
      setError('An error occurred while downloading payslip')
    } finally {
      setDownloadingId(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatPeriod = (period: string) => {
    return new Date(period + '-01').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return 'default'
      case 'SENT':
        return 'secondary'
      case 'ACCESSED':
        return 'outline'
      case 'DOWNLOADED':
        return 'default'
      default:
        return 'secondary'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading payslips...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Payslips</h2>
        <p className="text-gray-600">
          Download and view your salary slips
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {payslips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Payslips Available</h3>
            <p className="text-gray-600 text-center max-w-md">
              Your payslips will appear here once payroll has been processed and approved.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Available Payslips</span>
              <Badge variant="outline">{payslips.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pay Period</TableHead>
                    <TableHead>Generated Date</TableHead>
                    <TableHead>File Size</TableHead>
                    <TableHead>Downloads</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email Sent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((payslip) => (
                    <TableRow key={payslip.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">
                            {formatPeriod(payslip.payrollRun.period)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(payslip.generatedAt).toLocaleDateString('en-IN')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(payslip.generatedAt).toLocaleTimeString('en-IN')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatFileSize(payslip.fileSize)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Eye className="h-3 w-3 text-gray-400" />
                          <span className="text-sm">{payslip.downloadCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(payslip.status)}>
                          {payslip.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payslip.emailSent ? (
                          <div className="text-sm">
                            <div className="text-green-600">✓ Sent</div>
                            {payslip.emailSentAt && (
                              <div className="text-xs text-gray-500">
                                {new Date(payslip.emailSentAt).toLocaleDateString('en-IN')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Not sent</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2">
                          {onViewPayslip && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onViewPayslip(payslip.id)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleDownload(payslip.payrollRun.period, payslip.fileName)}
                            disabled={downloadingId === payslip.payrollRun.period}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {downloadingId === payslip.payrollRun.period ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-4 w-4" />
                            )}
                            Download
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Important Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
            <div>
              <p className="text-sm font-medium">Payslip Access</p>
              <p className="text-sm text-gray-600">
                Payslips are available for download once payroll has been processed and approved by HR/Finance.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-green-600 rounded-full mt-2"></div>
            <div>
              <p className="text-sm font-medium">Email Notifications</p>
              <p className="text-sm text-gray-600">
                You will receive an email notification when your payslip is ready for download.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
            <div>
              <p className="text-sm font-medium">Secure Access</p>
              <p className="text-sm text-gray-600">
                All payslips are securely generated and can only be accessed by you and authorized personnel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Download,
  FileText,
  Mail,
  Printer,
  TrendingUp,
  TrendingDown,
  Send,
  RefreshCw,
} from 'lucide-react'

interface PayslipData {
  employee: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    designation: string
    department: {
      name: string
    }
    joiningDate: string
    panNumber?: string
    pfNumber?: string
    esiNumber?: string
  }
  payrollRecord: {
    id: string
    period: string
    basicSalary: number
    grossSalary: number
    netSalary: number
    totalEarnings: number
    totalDeductions: number
    workingDays: number
    presentDays: number
    absentDays: number
    lopDays: number
    lopAmount: number
    overtimeHours: number
    overtimeAmount: number
    earnings: Array<{
      componentId: string
      componentName: string
      componentCode: string
      amount: number
      isProrated: boolean
    }>
    deductions: Array<{
      componentId: string
      componentName: string
      componentCode: string
      amount: number
      isStatutory: boolean
    }>
    statutoryDeductions: {
      pf: number
      esi: number
      tds: number
      pt: number
    }
  }
  company: {
    name: string
    address: string
    logo?: string
    pfNumber?: string
    esiNumber?: string
    tanNumber?: string
  }
}

interface PayslipGeneratorProps {
  payslipData: PayslipData
  onDownload?: (format: 'pdf' | 'html') => Promise<void>
  onEmail?: (emailData: {
    email: string
    customSubject?: string
    customMessage?: string
  }) => Promise<void>
  onPrint?: () => void
  isLoading?: boolean
}

export function PayslipGenerator({
  payslipData,
  onDownload,
  onEmail,
  onPrint,
  isLoading = false
}: PayslipGeneratorProps) {
  const [emailAddress, setEmailAddress] = useState(payslipData.employee.email)
  const [customSubject, setCustomSubject] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [isEmailing, setIsEmailing] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-')
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
    })
  }

  const handleDownload = async (format: 'pdf' | 'html') => {
    if (onDownload) {
      await onDownload(format)
    }
  }

  const handleEmail = async () => {
    if (onEmail && emailAddress) {
      setIsEmailing(true)
      try {
        await onEmail({
          email: emailAddress,
          customSubject: customSubject || undefined,
          customMessage: customMessage || undefined,
        })
        setShowEmailDialog(false)
        // Reset form
        setCustomSubject('')
        setCustomMessage('')
      } finally {
        setIsEmailing(false)
      }
    }
  }

  const handlePrint = () => {
    if (onPrint) {
      onPrint()
    } else {
      window.print()
    }
  }

  const { employee, payrollRecord, company } = payslipData

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payslip Generator</h2>
          <p className="text-gray-600">
            {employee.firstName} {employee.lastName} - {formatPeriod(payrollRecord.period)}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => handleDownload('pdf')}
            disabled={isLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownload('html')}
            disabled={isLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            HTML
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={isLoading}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          
          <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={isLoading}>
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Payslip via Email</DialogTitle>
                <DialogDescription>
                  Send the payslip to the employee's email address with optional customization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="emailAddress">Email Address</Label>
                  <Input
                    id="emailAddress"
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="employee@company.com"
                  />
                </div>
                <div>
                  <Label htmlFor="customSubject">Custom Subject (Optional)</Label>
                  <Input
                    id="customSubject"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="e.g., Your Salary Slip for March 2024"
                  />
                </div>
                <div>
                  <Label htmlFor="customMessage">Custom Message (Optional)</Label>
                  <Textarea
                    id="customMessage"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a custom message to include in the email..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowEmailDialog(false)}
                  disabled={isEmailing}
                >
                  Cancel
                </Button>
                <Button onClick={handleEmail} disabled={isEmailing || !emailAddress}>
                  {isEmailing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Email
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            <Button
              onClick={handleEmail}
              disabled={isEmailing || !emailAddress}
            >
              <Mail className="mr-2 h-4 w-4" />
              {isEmailing ? 'Sending...' : 'Email'}
            </Button>
          </div>
        </div>
      {/* </div> */}

      {/* Payslip Content */}
      <div ref={printRef} className="bg-white">
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="text-center border-b">
            <div className="flex items-center justify-center space-x-4 mb-4">
              {company.logo && (
                <img src={company.logo} alt="Company Logo" className="h-12 w-12" />
              )}
              <div>
                <CardTitle className="text-2xl font-bold">{company.name}</CardTitle>
                <p className="text-sm text-gray-600">{company.address}</p>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <h2 className="text-xl font-semibold text-blue-900">
                SALARY SLIP FOR {formatPeriod(payrollRecord.period).toUpperCase()}
              </h2>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Employee Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">Employee Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Employee Code:</span>
                    <span className="font-medium">{employee.employeeCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">{employee.firstName} {employee.lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Designation:</span>
                    <span className="font-medium">{employee.designation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Department:</span>
                    <span className="font-medium">{employee.department.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date of Joining:</span>
                    <span className="font-medium">{formatDate(employee.joiningDate)}</span>
                  </div>
                  {employee.panNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">PAN:</span>
                      <span className="font-medium">{employee.panNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">Attendance Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Working Days:</span>
                    <span className="font-medium">{payrollRecord.workingDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Present Days:</span>
                    <span className="font-medium text-green-600">{payrollRecord.presentDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Absent Days:</span>
                    <span className="font-medium text-red-600">{payrollRecord.absentDays}</span>
                  </div>
                  {payrollRecord.lopDays > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">LOP Days:</span>
                      <span className="font-medium text-orange-600">{payrollRecord.lopDays}</span>
                    </div>
                  )}
                  {payrollRecord.overtimeHours > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Overtime Hours:</span>
                      <span className="font-medium text-blue-600">{payrollRecord.overtimeHours}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Salary Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Earnings */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2 text-green-700">
                  <TrendingUp className="inline mr-2 h-5 w-5" />
                  Earnings
                </h3>
                <div className="space-y-2">
                  {payrollRecord.earnings.map((earning, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-2">
                        <span>{earning.componentName}</span>
                        {earning.isProrated && (
                          <Badge variant="outline" className="text-xs">
                            Prorated
                          </Badge>
                        )}
                      </div>
                      <span className="font-medium">{formatCurrency(earning.amount)}</span>
                    </div>
                  ))}
                  
                  {payrollRecord.overtimeAmount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-2">
                        <span>Overtime Pay</span>
                        <Badge variant="outline" className="text-xs">
                          {payrollRecord.overtimeHours}h
                        </Badge>
                      </div>
                      <span className="font-medium">{formatCurrency(payrollRecord.overtimeAmount)}</span>
                    </div>
                  )}
                  
                  <Separator />
                  <div className="flex justify-between items-center font-semibold text-green-700">
                    <span>Total Earnings</span>
                    <span>{formatCurrency(payrollRecord.totalEarnings)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2 text-red-700">
                  <TrendingDown className="inline mr-2 h-5 w-5" />
                  Deductions
                </h3>
                <div className="space-y-2">
                  {payrollRecord.deductions.map((deduction, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-2">
                        <span>{deduction.componentName}</span>
                        {deduction.isStatutory && (
                          <Badge variant="secondary" className="text-xs">
                            Statutory
                          </Badge>
                        )}
                      </div>
                      <span className="font-medium">{formatCurrency(deduction.amount)}</span>
                    </div>
                  ))}
                  
                  {payrollRecord.lopAmount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-2">
                        <span>Loss of Pay</span>
                        <Badge variant="outline" className="text-xs">
                          {payrollRecord.lopDays} days
                        </Badge>
                      </div>
                      <span className="font-medium">{formatCurrency(payrollRecord.lopAmount)}</span>
                    </div>
                  )}
                  
                  <Separator />
                  <div className="flex justify-between items-center font-semibold text-red-700">
                    <span>Total Deductions</span>
                    <span>{formatCurrency(payrollRecord.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Net Salary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-blue-900">Net Salary</span>
                <span className="text-2xl font-bold text-blue-900">
                  {formatCurrency(payrollRecord.netSalary)}
                </span>
              </div>
              <p className="text-sm text-blue-700 mt-2">
                In Words: {numberToWords(payrollRecord.netSalary)} Rupees Only
              </p>
            </div>

            {/* Statutory Information */}
            {(company.pfNumber || company.esiNumber || employee.pfNumber || employee.esiNumber) && (
              <>
                <Separator className="my-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Company Statutory Details</h4>
                    <div className="text-sm space-y-1">
                      {company.pfNumber && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">PF Number:</span>
                          <span>{company.pfNumber}</span>
                        </div>
                      )}
                      {company.esiNumber && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">ESI Number:</span>
                          <span>{company.esiNumber}</span>
                        </div>
                      )}
                      {company.tanNumber && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">TAN Number:</span>
                          <span>{company.tanNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold">Employee Statutory Details</h4>
                    <div className="text-sm space-y-1">
                      {employee.pfNumber && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">PF Number:</span>
                          <span>{employee.pfNumber}</span>
                        </div>
                      )}
                      {employee.esiNumber && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">ESI Number:</span>
                          <span>{employee.esiNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
              <p>This is a computer-generated payslip and does not require a signature.</p>
              <p>Generated on {new Date().toLocaleDateString('en-IN')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Helper function to convert number to words (simplified version)
function numberToWords(num: number): string {
  if (num === 0) return 'Zero'
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  
  function convertHundreds(n: number): string {
    let result = ''
    
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred '
      n %= 100
    }
    
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' '
      n %= 10
    } else if (n >= 10) {
      result += teens[n - 10] + ' '
      return result
    }
    
    if (n > 0) {
      result += ones[n] + ' '
    }
    
    return result
  }
  
  let result = ''
  let crore = Math.floor(num / 10000000)
  let lakh = Math.floor((num % 10000000) / 100000)
  let thousand = Math.floor((num % 100000) / 1000)
  let hundred = num % 1000
  
  if (crore > 0) {
    result += convertHundreds(crore) + 'Crore '
  }
  
  if (lakh > 0) {
    result += convertHundreds(lakh) + 'Lakh '
  }
  
  if (thousand > 0) {
    result += convertHundreds(thousand) + 'Thousand '
  }
  
  if (hundred > 0) {
    result += convertHundreds(hundred)
  }
  
  return result.trim()
}
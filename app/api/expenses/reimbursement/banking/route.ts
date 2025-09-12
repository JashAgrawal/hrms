import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bankingIntegrationSchema = z.object({
  batchId: z.string(),
  bankingProvider: z.enum(['ICICI', 'HDFC', 'SBI', 'AXIS', 'KOTAK', 'MANUAL']),
  paymentMode: z.enum(['NEFT', 'RTGS', 'IMPS', 'UPI']).default('NEFT'),
  generateFile: z.boolean().default(true),
  processPayment: z.boolean().default(false)
})

const validateBankDetailsSchema = z.object({
  employeeIds: z.array(z.string()).min(1)
})

// POST /api/expenses/reimbursement/banking - Process banking integration
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const canProcessBanking = ['ADMIN', 'FINANCE'].includes(user?.role || '')
    
    if (!canProcessBanking) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = bankingIntegrationSchema.parse(body)

    // Get batch details with employee banking information
    const batch = await prisma.reimbursementBatch.findUnique({
      where: { id: validatedData.batchId },
      include: {
        expenseClaims: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                employeeCode: true,
                bankAccountNumber: true,
                bankIFSC: true,
                bankName: true,
                bankBranch: true,
                panNumber: true
              }
            }
          }
        }
      }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    if (batch.status !== 'PROCESSING') {
      return NextResponse.json(
        { error: 'Batch must be in PROCESSING status for banking integration' },
        { status: 400 }
      )
    }

    // Validate employee banking details
    const employeesWithMissingBankDetails: string[] = []
    const validPayments: any[] = []

    // Group claims by employee
    const employeeClaimsMap = new Map()
    batch.expenseClaims.forEach(claim => {
      const empId = claim.employee.id
      if (!employeeClaimsMap.has(empId)) {
        employeeClaimsMap.set(empId, {
          employee: claim.employee,
          claims: [],
          totalAmount: 0
        })
      }
      const empData = employeeClaimsMap.get(empId)
      empData.claims.push(claim)
      empData.totalAmount += claim.amount.toNumber()
    })

    // Validate each employee's banking details
    for (const [empId, empData] of employeeClaimsMap) {
      const employee = empData.employee
      
      if (!employee.bankAccountNumber || !employee.bankIFSC || !employee.bankName) {
        employeesWithMissingBankDetails.push(
          `${employee.firstName} ${employee.lastName} (${employee.employeeCode})`
        )
      } else {
        validPayments.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeCode: employee.employeeCode,
          accountNumber: employee.bankAccountNumber,
          ifscCode: employee.bankIFSC,
          bankName: employee.bankName,
          bankBranch: employee.bankBranch,
          amount: empData.totalAmount,
          claimIds: empData.claims.map((c: any) => c.id),
          email: employee.email,
          panNumber: employee.panNumber
        })
      }
    }

    if (employeesWithMissingBankDetails.length > 0) {
      return NextResponse.json({
        error: 'Some employees have incomplete banking details',
        missingBankDetails: employeesWithMissingBankDetails,
        validPayments: validPayments.length,
        totalValidAmount: validPayments.reduce((sum, p) => sum + p.amount, 0)
      }, { status: 400 })
    }

    let bankingFile: any = null
    let paymentResponse: any = null

    // Generate banking file if requested
    if (validatedData.generateFile) {
      bankingFile = await generateBankingFile(
        validPayments,
        validatedData.bankingProvider,
        validatedData.paymentMode,
        batch
      )
    }

    // Process payment if requested (simulation for now)
    if (validatedData.processPayment) {
      paymentResponse = await processBankingPayment(
        validPayments,
        validatedData.bankingProvider,
        validatedData.paymentMode,
        batch
      )
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'BANKING_INTEGRATION_PROCESSED',
        resource: 'REIMBURSEMENT_BATCH',
        details: {
          batchId: batch.batchId,
          bankingProvider: validatedData.bankingProvider,
          paymentMode: validatedData.paymentMode,
          totalPayments: validPayments.length,
          totalAmount: validPayments.reduce((sum, p) => sum + p.amount, 0),
          fileGenerated: validatedData.generateFile,
          paymentProcessed: validatedData.processPayment
        }
      }
    })

    return NextResponse.json({
      message: 'Banking integration processed successfully',
      batchId: batch.batchId,
      totalPayments: validPayments.length,
      totalAmount: validPayments.reduce((sum, p) => sum + p.amount, 0),
      bankingFile,
      paymentResponse,
      validPayments: validPayments.map(p => ({
        employeeName: p.employeeName,
        employeeCode: p.employeeCode,
        amount: p.amount,
        accountNumber: p.accountNumber.replace(/\d(?=\d{4})/g, '*') // Mask account number
      }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing banking integration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/expenses/reimbursement/banking - Validate employee bank details
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const canValidateBankDetails = ['ADMIN', 'FINANCE', 'HR'].includes(user?.role || '')
    
    if (!canValidateBankDetails) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = validateBankDetailsSchema.parse(body)

    // Get employees with their banking details
    const employees = await prisma.employee.findMany({
      where: { id: { in: validatedData.employeeIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        email: true,
        bankAccountNumber: true,
        bankIFSC: true,
        bankName: true,
        bankBranch: true,
        panNumber: true
      }
    })

    const validationResults = employees.map(employee => {
      const issues: string[] = []
      
      if (!employee.bankAccountNumber) issues.push('Bank account number missing')
      if (!employee.bankIFSC) issues.push('IFSC code missing')
      if (!employee.bankName) issues.push('Bank name missing')
      if (!employee.panNumber) issues.push('PAN number missing')
      
      // Validate IFSC format (basic validation)
      if (employee.bankIFSC && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(employee.bankIFSC)) {
        issues.push('Invalid IFSC code format')
      }
      
      // Validate PAN format (basic validation)
      if (employee.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(employee.panNumber)) {
        issues.push('Invalid PAN number format')
      }

      return {
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        email: employee.email,
        isValid: issues.length === 0,
        issues,
        bankDetails: {
          accountNumber: employee.bankAccountNumber ? 
            employee.bankAccountNumber.replace(/\d(?=\d{4})/g, '*') : null,
          ifscCode: employee.bankIFSC,
          bankName: employee.bankName,
          bankBranch: employee.bankBranch,
          panNumber: employee.panNumber ? 
            employee.panNumber.replace(/\w(?=\w{4})/g, '*') : null
        }
      }
    })

    const validEmployees = validationResults.filter(r => r.isValid)
    const invalidEmployees = validationResults.filter(r => !r.isValid)

    return NextResponse.json({
      totalEmployees: employees.length,
      validEmployees: validEmployees.length,
      invalidEmployees: invalidEmployees.length,
      validationResults,
      summary: {
        readyForPayment: validEmployees.length,
        needingAttention: invalidEmployees.length,
        commonIssues: getCommonIssues(invalidEmployees)
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error validating bank details:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to generate banking file
async function generateBankingFile(
  payments: any[],
  provider: string,
  paymentMode: string,
  batch: any
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `${provider}_${paymentMode}_${batch.batchId}_${timestamp}`

  switch (provider) {
    case 'ICICI':
      return generateICICIFile(payments, paymentMode, fileName)
    case 'HDFC':
      return generateHDFCFile(payments, paymentMode, fileName)
    case 'SBI':
      return generateSBIFile(payments, paymentMode, fileName)
    default:
      return generateGenericFile(payments, paymentMode, fileName)
  }
}

// Helper function to generate ICICI bank file format
function generateICICIFile(payments: any[], paymentMode: string, fileName: string) {
  const header = `H,${paymentMode},${new Date().toISOString().split('T')[0]},${payments.length},${payments.reduce((sum, p) => sum + p.amount, 0)}`
  
  const details = payments.map((payment, index) => {
    return `D,${index + 1},${payment.accountNumber},${payment.ifscCode},${payment.employeeName},${payment.amount},Reimbursement Payment,${payment.employeeCode}`
  })

  const content = [header, ...details].join('\n')
  
  return {
    fileName: `${fileName}.txt`,
    content,
    format: 'ICICI_BULK_UPLOAD',
    totalRecords: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0)
  }
}

// Helper function to generate HDFC bank file format
function generateHDFCFile(payments: any[], paymentMode: string, fileName: string) {
  const records = payments.map((payment, index) => {
    return {
      srNo: index + 1,
      beneficiaryName: payment.employeeName,
      accountNumber: payment.accountNumber,
      ifscCode: payment.ifscCode,
      amount: payment.amount,
      paymentMode,
      narration: `Reimbursement - ${payment.employeeCode}`
    }
  })

  return {
    fileName: `${fileName}.json`,
    content: JSON.stringify(records, null, 2),
    format: 'HDFC_JSON',
    totalRecords: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0)
  }
}

// Helper function to generate SBI bank file format
function generateSBIFile(payments: any[], paymentMode: string, fileName: string) {
  const csvHeader = 'Sr No,Beneficiary Name,Account Number,IFSC Code,Amount,Payment Mode,Narration'
  
  const csvRows = payments.map((payment, index) => {
    return `${index + 1},"${payment.employeeName}",${payment.accountNumber},${payment.ifscCode},${payment.amount},${paymentMode},"Reimbursement - ${payment.employeeCode}"`
  })

  const content = [csvHeader, ...csvRows].join('\n')
  
  return {
    fileName: `${fileName}.csv`,
    content,
    format: 'SBI_CSV',
    totalRecords: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0)
  }
}

// Helper function to generate generic bank file format
function generateGenericFile(payments: any[], paymentMode: string, fileName: string) {
  const records = payments.map((payment, index) => ({
    serialNumber: index + 1,
    beneficiaryName: payment.employeeName,
    accountNumber: payment.accountNumber,
    ifscCode: payment.ifscCode,
    bankName: payment.bankName,
    amount: payment.amount,
    paymentMode,
    narration: `Expense Reimbursement - ${payment.employeeCode}`,
    email: payment.email,
    panNumber: payment.panNumber
  }))

  return {
    fileName: `${fileName}.json`,
    content: JSON.stringify(records, null, 2),
    format: 'GENERIC_JSON',
    totalRecords: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0)
  }
}

// Helper function to process banking payment (simulation)
async function processBankingPayment(
  payments: any[],
  provider: string,
  paymentMode: string,
  batch: any
) {
  // This is a simulation - in real implementation, this would integrate with actual banking APIs
  
  const processingTime = Math.random() * 2000 + 1000 // 1-3 seconds simulation
  await new Promise(resolve => setTimeout(resolve, processingTime))

  // Simulate success/failure (95% success rate)
  const isSuccess = Math.random() > 0.05

  if (isSuccess) {
    const referenceNumber = `${provider}${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    
    return {
      status: 'SUCCESS',
      referenceNumber,
      transactionId: `TXN${Date.now()}`,
      processedAt: new Date().toISOString(),
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      totalPayments: payments.length,
      provider,
      paymentMode,
      estimatedSettlement: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Next day
    }
  } else {
    return {
      status: 'FAILED',
      errorCode: 'BANK_ERROR_001',
      errorMessage: 'Temporary banking service unavailable. Please retry later.',
      failedAt: new Date().toISOString(),
      provider,
      paymentMode
    }
  }
}

// Helper function to get common issues
function getCommonIssues(invalidEmployees: any[]) {
  const issueCount: Record<string, number> = {}
  
  invalidEmployees.forEach(emp => {
    emp.issues.forEach((issue: string) => {
      issueCount[issue] = (issueCount[issue] || 0) + 1
    })
  })

  return Object.entries(issueCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([issue, count]) => ({ issue, count }))
}
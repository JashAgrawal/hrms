import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'pdf'

    // Get report details from audit log
    const reportLog = await prisma.auditLog.findUnique({
      where: { id },
    })

    if (!reportLog || reportLog.action !== 'GENERATE_PAYROLL_REPORT') {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Generate file based on format
    let fileContent: Buffer
    let contentType: string
    let filename: string

    const reportDetails = reportLog.details as any
    const period = reportDetails.period
    const reportType = reportDetails.reportType

    switch (format) {
      case 'pdf':
        fileContent = await generatePDFReport(reportDetails)
        contentType = 'application/pdf'
        filename = `payroll-${reportType}-${period}.pdf`
        break
      case 'excel':
        fileContent = await generateExcelReport(reportDetails)
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = `payroll-${reportType}-${period}.xlsx`
        break
      case 'csv':
        fileContent = await generateCSVReport(reportDetails)
        contentType = 'text/csv'
        filename = `payroll-${reportType}-${period}.csv`
        break
      default:
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }

    // Return file
    return new NextResponse(fileContent as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileContent.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error downloading report:', error)
    return NextResponse.json(
      { error: 'Failed to download report' },
      { status: 500 }
    )
  }
}

async function generatePDFReport(reportDetails: any): Promise<Buffer> {
  // In a real implementation, you would use a PDF generation library like puppeteer or jsPDF
  // For now, return a placeholder
  const content = `
    Payroll Report
    Type: ${reportDetails.reportType}
    Period: ${reportDetails.period}
    Generated: ${new Date().toISOString()}
    
    This is a placeholder PDF content.
    In a real implementation, this would contain the actual report data.
  `
  
  return Buffer.from(content, 'utf-8')
}

async function generateExcelReport(reportDetails: any): Promise<Buffer> {
  // In a real implementation, you would use a library like exceljs
  // For now, return a placeholder CSV-like content
  const content = `
Employee Code,Name,Department,Basic Salary,Gross Salary,Net Salary
EMP001,John Doe,Engineering,50000,80000,65000
EMP002,Jane Smith,HR,45000,70000,58000
  `
  
  return Buffer.from(content, 'utf-8')
}

async function generateCSVReport(reportDetails: any): Promise<Buffer> {
  // Generate CSV content based on report type
  let csvContent = ''
  
  switch (reportDetails.reportType) {
    case 'summary':
      csvContent = `Period,Total Employees,Total Gross,Total Net,Total Deductions\n`
      csvContent += `${reportDetails.period},${reportDetails.recordCount || 0},0,0,0\n`
      break
    case 'detailed':
      csvContent = `Employee Code,Name,Department,Designation,Basic Salary,Gross Salary,Net Salary,Working Days,Present Days,Status\n`
      // In real implementation, iterate through actual records
      csvContent += `EMP001,John Doe,Engineering,Software Engineer,50000,80000,65000,22,22,PAID\n`
      break
    case 'statutory':
      csvContent = `Employee Code,Name,PAN,PF Number,Basic Salary,PF Deduction,ESI Deduction,TDS Deduction,PT Deduction\n`
      csvContent += `EMP001,John Doe,ABCDE1234F,PF123456,50000,6000,600,2000,200\n`
      break
    default:
      csvContent = `Report Type,Period,Generated At\n`
      csvContent += `${reportDetails.reportType},${reportDetails.period},${new Date().toISOString()}\n`
  }
  
  return Buffer.from(csvContent, 'utf-8')
}
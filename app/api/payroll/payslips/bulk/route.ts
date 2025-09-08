import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { payslipService } from '@/lib/payslip-service'
import { z } from 'zod'

const bulkPayslipSchema = z.object({
  payrollRunId: z.string(),
  format: z.enum(['json', 'html']).default('json'),
  emailDistribution: z.boolean().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to generate bulk payslips
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { payrollRunId, format, emailDistribution } = bulkPayslipSchema.parse(body)

    // Generate payslips for all approved/paid records in the payroll run
    const payslips = await payslipService.getBulkPayslips(payrollRunId)

    if (payslips.length === 0) {
      return NextResponse.json(
        { error: 'No approved payroll records found for this run' },
        { status: 400 }
      )
    }

    if (format === 'html') {
      // Generate HTML payslips
      const htmlPayslips = payslips.map(payslipData => {
        const template = payslipService.generatePayslipTemplate(payslipData)
        return {
          employeeId: payslipData.employee.id,
          employeeCode: payslipData.employee.employeeCode,
          employeeName: `${payslipData.employee.firstName} ${payslipData.employee.lastName}`,
          email: payslipData.employee.email,
          html: payslipService.generatePayslipHTML(template),
          filename: `payslip-${payslipData.employee.employeeCode}-${payslipData.payrollRun.period}.html`,
        }
      })

      // If email distribution is requested, send emails
      if (emailDistribution) {
        const emailResults = await sendBulkPayslipEmails(htmlPayslips)
        
        return NextResponse.json({
          message: 'Bulk payslips generated and emails sent',
          totalPayslips: payslips.length,
          emailResults,
          payslips: htmlPayslips.map(p => ({
            employeeCode: p.employeeCode,
            employeeName: p.employeeName,
            filename: p.filename,
          })),
        })
      }

      return NextResponse.json({
        message: 'Bulk payslips generated successfully',
        totalPayslips: payslips.length,
        payslips: htmlPayslips,
      })
    }

    // Return JSON data
    return NextResponse.json({
      message: 'Bulk payslips generated successfully',
      totalPayslips: payslips.length,
      payslips,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error generating bulk payslips:', error)
    return NextResponse.json(
      { error: 'Failed to generate bulk payslips' },
      { status: 500 }
    )
  }
}

// Helper function to send bulk payslip emails
async function sendBulkPayslipEmails(payslips: any[]) {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const payslip of payslips) {
    try {
      // In a real application, you would use a proper email service like SendGrid, AWS SES, etc.
      // For now, we'll simulate email sending
      await simulateEmailSending(payslip)
      results.sent++
    } catch (error) {
      results.failed++
      results.errors.push(`Failed to send to ${payslip.employeeCode}: ${error}`)
    }
  }

  return results
}

// Simulate email sending (replace with actual email service)
async function simulateEmailSending(payslip: any) {
  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Simulate occasional failures (5% failure rate)
  if (Math.random() < 0.05) {
    throw new Error('Email service temporarily unavailable')
  }

  console.log(`📧 Payslip email sent to ${payslip.employeeName} (${payslip.email})`)
  
  // In a real implementation, you would:
  // 1. Use an email service like SendGrid, AWS SES, or Nodemailer
  // 2. Create a proper email template
  // 3. Attach the HTML payslip or convert to PDF
  // 4. Handle email delivery status and retries
  // 5. Log email activities for audit purposes
  
  return true
}
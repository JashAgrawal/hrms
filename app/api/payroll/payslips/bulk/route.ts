import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { payslipService } from '@/lib/payslip-service'
import { emailService } from '@/lib/email-service'
import { z } from 'zod'

const bulkPayslipSchema = z.object({
  payrollRunId: z.string(),
  format: z.enum(['pdf', 'html']).default('pdf'),
  emailDistribution: z.boolean().default(false),
  customSubject: z.string().optional(),
  customMessage: z.string().optional(),
  batchSize: z.number().min(1).max(50).default(10),
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
    const { 
      payrollRunId, 
      format, 
      emailDistribution, 
      customSubject, 
      customMessage,
      batchSize 
    } = bulkPayslipSchema.parse(body)

    // Get payroll run details
    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        payrollRecords: {
          where: {
            status: { in: ['APPROVED', 'PAID'] },
          },
          include: {
            employee: {
              include: {
                department: true,
              },
            },
          },
          orderBy: {
            employee: {
              employeeCode: 'asc',
            },
          },
        },
      },
    })

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    }

    if (payrollRun.payrollRecords.length === 0) {
      return NextResponse.json(
        { error: 'No approved payroll records found for this run' },
        { status: 400 }
      )
    }

    const results = {
      totalRecords: payrollRun.payrollRecords.length,
      generated: 0,
      failed: 0,
      emailsSent: 0,
      emailsFailed: 0,
      errors: [] as string[],
      payslips: [] as any[],
    }

    // Process payslips in batches
    for (let i = 0; i < payrollRun.payrollRecords.length; i += batchSize) {
      const batch = payrollRun.payrollRecords.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (record) => {
        try {
          // Get payslip data
          const payslipData = await payslipService.getPayslipData(record.id)
          
          let payslipBuffer: Buffer
          let fileName: string
          let contentType: string

          if (format === 'pdf') {
            payslipBuffer = await payslipService.generatePayslipPDF(payslipData)
            fileName = `payslip-${payslipData.employee.employeeCode}-${payslipData.payrollRun.period}.pdf`
            contentType = 'application/pdf'
          } else {
            const template = payslipService.generatePayslipTemplate(payslipData)
            const html = payslipService.generatePayslipHTML(template)
            payslipBuffer = Buffer.from(html, 'utf-8')
            fileName = `payslip-${payslipData.employee.employeeCode}-${payslipData.payrollRun.period}.html`
            contentType = 'text/html'
          }

          // Create or update payslip record
          const existingPayslip = await prisma.payslip.findUnique({
            where: {
              employeeId_payrollRunId: {
                employeeId: record.employeeId,
                payrollRunId: record.payrollRunId,
              },
            },
          })

          let payslip
          if (existingPayslip) {
            payslip = await prisma.payslip.update({
              where: { id: existingPayslip.id },
              data: {
                fileName,
                fileSize: payslipBuffer.length,
                generatedAt: new Date(),
                generatedBy: session.user.id,
                status: 'GENERATED',
              },
            })
          } else {
            payslip = await prisma.payslip.create({
              data: {
                employeeId: record.employeeId,
                payrollRunId: record.payrollRunId,
                fileName,
                fileSize: payslipBuffer.length,
                generatedAt: new Date(),
                generatedBy: session.user.id,
                status: 'GENERATED',
              },
            })
          }

          results.generated++
          
          const payslipInfo = {
            id: payslip.id,
            employeeId: record.employee.id,
            employeeCode: record.employee.employeeCode,
            employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
            email: record.employee.email,
            fileName,
            fileSize: payslipBuffer.length,
            generatedAt: payslip.generatedAt,
            emailSent: false,
          }

          // Send email if requested
          if (emailDistribution) {
            try {
              const emailSent = await emailService.sendPayslipEmail({
                employeeEmail: record.employee.email,
                employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
                period: payrollRun.period,
                payslipBuffer,
                payslipFileName: fileName,
                customSubject,
                customMessage,
              })

              if (emailSent) {
                await prisma.payslip.update({
                  where: { id: payslip.id },
                  data: {
                    emailSent: true,
                    emailSentAt: new Date(),
                  },
                })
                results.emailsSent++
                payslipInfo.emailSent = true
              } else {
                results.emailsFailed++
                results.errors.push(`Failed to send email to ${record.employee.employeeCode}`)
              }
            } catch (emailError) {
              results.emailsFailed++
              results.errors.push(`Email error for ${record.employee.employeeCode}: ${emailError}`)
            }
          }

          results.payslips.push(payslipInfo)
        } catch (error) {
          results.failed++
          results.errors.push(`Failed to generate payslip for ${record.employee.employeeCode}: ${error}`)
        }
      })

      await Promise.all(batchPromises)
      
      // Add small delay between batches to avoid overwhelming the system
      if (i + batchSize < payrollRun.payrollRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    const message = emailDistribution 
      ? `Bulk payslips generated. ${results.generated} generated, ${results.emailsSent} emails sent, ${results.emailsFailed} email failures`
      : `Bulk payslips generated successfully. ${results.generated} generated, ${results.failed} failed`

    return NextResponse.json({
      message,
      results,
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


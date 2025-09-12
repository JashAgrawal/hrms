import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { payslipService } from '@/lib/payslip-service'
import { z } from 'zod'

const generatePayslipSchema = z.object({
  payrollRecordId: z.string(),
  format: z.enum(['pdf', 'html']).default('pdf'),
  email: z.boolean().default(false),
  customSubject: z.string().optional(),
  customMessage: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { payrollRecordId, format, email, customSubject, customMessage } = generatePayslipSchema.parse(body)

    // Get payroll record
    const payrollRecord = await prisma.payrollRecord.findUnique({
      where: { id: payrollRecordId },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
        payrollRun: true,
      },
    })

    if (!payrollRecord) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 })
    }

    // Check if payslip can be generated (only for approved/paid records)
    if (!['APPROVED', 'PAID'].includes(payrollRecord.status)) {
      return NextResponse.json(
        { error: 'Payslip can only be generated for approved or paid records' },
        { status: 400 }
      )
    }

    // Get payslip data
    const payslipData = await payslipService.getPayslipData(payrollRecordId)

    let payslipBuffer: Buffer
    let contentType: string
    let fileName: string

    if (format === 'pdf') {
      payslipBuffer = await payslipService.generatePayslipPDF(payslipData)
      contentType = 'application/pdf'
      fileName = `payslip-${payslipData.employee.employeeCode}-${payslipData.payrollRun.period}.pdf`
    } else {
      const template = payslipService.generatePayslipTemplate(payslipData)
      const html = payslipService.generatePayslipHTML(template)
      payslipBuffer = Buffer.from(html, 'utf-8')
      contentType = 'text/html'
      fileName = `payslip-${payslipData.employee.employeeCode}-${payslipData.payrollRun.period}.html`
    }

    // Create or update payslip record
    const existingPayslip = await prisma.payslip.findUnique({
      where: {
        employeeId_payrollRunId: {
          employeeId: payrollRecord.employeeId,
          payrollRunId: payrollRecord.payrollRunId,
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
          employeeId: payrollRecord.employeeId,
          payrollRunId: payrollRecord.payrollRunId,
          fileName,
          fileSize: payslipBuffer.length,
          generatedAt: new Date(),
          generatedBy: session.user.id,
          status: 'GENERATED',
        },
      })
    }

    // Send email if requested
    if (email) {
      const { emailService } = await import('@/lib/email-service')
      
      const emailSent = await emailService.sendPayslipEmail({
        employeeEmail: payslipData.employee.email,
        employeeName: `${payslipData.employee.firstName} ${payslipData.employee.lastName}`,
        period: payslipData.payrollRun.period,
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
      }

      return NextResponse.json({
        message: 'Payslip generated and email sent successfully',
        payslip: {
          id: payslip.id,
          fileName,
          generatedAt: payslip.generatedAt,
          emailSent,
        },
      })
    }

    // Return the payslip file
    return new NextResponse(payslipBuffer as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': payslipBuffer.length.toString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error generating payslip:', error)
    return NextResponse.json(
      { error: 'Failed to generate payslip' },
      { status: 500 }
    )
  }
}

// GET endpoint to list payslips for a payroll run
export async function GET(request: NextRequest) {
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
    const payrollRunId = searchParams.get('payrollRunId')

    if (!payrollRunId) {
      return NextResponse.json({ error: 'Payroll run ID is required' }, { status: 400 })
    }

    const payslips = await prisma.payslip.findMany({
      where: { payrollRunId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        payrollRun: {
          select: {
            id: true,
            period: true,
          },
        },
      },
      orderBy: {
        employee: {
          employeeCode: 'asc',
        },
      },
    })

    return NextResponse.json({
      payslips: payslips.map(payslip => ({
        id: payslip.id,
        fileName: payslip.fileName,
        fileSize: payslip.fileSize,
        generatedAt: payslip.generatedAt,
        emailSent: payslip.emailSent,
        emailSentAt: payslip.emailSentAt,
        downloadCount: payslip.downloadCount,
        status: payslip.status,
        employee: {
          id: payslip.employee.id,
          employeeCode: payslip.employee.employeeCode,
          name: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
          email: payslip.employee.email,
        },
        payrollRun: payslip.payrollRun,
      })),
    })
  } catch (error) {
    console.error('Error fetching payslips:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payslips' },
      { status: 500 }
    )
  }
}
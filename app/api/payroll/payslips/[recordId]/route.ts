import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { payslipService } from '@/lib/payslip-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the payroll record to check permissions
    const payrollRecord = await prisma.payrollRecord.findUnique({
      where: { id: recordId },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    })

    if (!payrollRecord) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 })
    }

    // Check permissions - employees can only view their own payslips
    if (session.user.role === 'EMPLOYEE') {
      if (payrollRecord.employee.userId !== session.user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    } else if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if payslip can be accessed (only for approved/paid records)
    if (!['APPROVED', 'PAID'].includes(payrollRecord.status)) {
      return NextResponse.json(
        { error: 'Payslip not available for this record' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const download = searchParams.get('download') === 'true'

    // Get payslip data
    const payslipData = await payslipService.getPayslipData(recordId)

    if (format === 'pdf') {
      // Generate PDF payslip
      const pdfBuffer = await payslipService.generatePayslipPDF(payslipData)
      const fileName = `payslip-${payslipData.employee.employeeCode}-${payslipData.payrollRun.period}.pdf`

      // Update download count
      await prisma.payslip.updateMany({
        where: {
          employeeId: payrollRecord.employeeId,
          payrollRunId: payrollRecord.payrollRunId,
        },
        data: {
          downloadCount: { increment: 1 },
          accessedAt: new Date(),
        },
      })

      return new NextResponse(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': download 
            ? `attachment; filename="${fileName}"` 
            : `inline; filename="${fileName}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      })
    }

    if (format === 'html') {
      // Generate HTML payslip
      const template = payslipService.generatePayslipTemplate(payslipData)
      const htmlContent = payslipService.generatePayslipHTML(template)
      const fileName = `payslip-${payslipData.employee.employeeCode}-${payslipData.payrollRun.period}.html`

      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': download 
            ? `attachment; filename="${fileName}"` 
            : `inline; filename="${fileName}"`,
        },
      })
    }

    // Return JSON data
    return NextResponse.json(payslipData)
  } catch (error) {
    console.error('Error generating payslip:', error)
    return NextResponse.json(
      { error: 'Failed to generate payslip' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { payslipService } from '@/lib/payslip-service'
import { emailService } from '@/lib/email-service'
import { z } from 'zod'

const distributePayslipsSchema = z.object({
  payrollRunId: z.string(),
  employeeIds: z.array(z.string()).optional(), // If not provided, send to all employees
  customSubject: z.string().optional(),
  customMessage: z.string().optional(),
  batchSize: z.number().min(1).max(20).default(5), // Smaller batch size for email distribution
  delayBetweenBatches: z.number().min(100).max(5000).default(1000), // Delay in milliseconds
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
    const { 
      payrollRunId, 
      employeeIds, 
      customSubject, 
      customMessage,
      batchSize,
      delayBetweenBatches 
    } = distributePayslipsSchema.parse(body)

    // Get payroll run and payslips
    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        payslips: {
          where: employeeIds ? { employeeId: { in: employeeIds } } : {},
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

    if (payrollRun.payslips.length === 0) {
      return NextResponse.json(
        { error: 'No payslips found for distribution' },
        { status: 400 }
      )
    }

    const results = {
      totalPayslips: payrollRun.payslips.length,
      emailsSent: 0,
      emailsFailed: 0,
      errors: [] as string[],
      distributionDetails: [] as any[],
    }

    // Process payslips in batches
    for (let i = 0; i < payrollRun.payslips.length; i += batchSize) {
      const batch = payrollRun.payslips.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (payslip) => {
        const employee = payslip.employee
        const employeeName = `${employee.firstName} ${employee.lastName}`
        
        try {
          // Get payslip data and generate PDF
          const payslipData = await payslipService.getPayslipData(payslip.id)
          const payslipBuffer = await payslipService.generatePayslipPDF(payslipData)
          
          // Send email
          const emailSent = await emailService.sendPayslipEmail({
            employeeEmail: employee.email,
            employeeName,
            period: payrollRun.period,
            payslipBuffer,
            payslipFileName: payslip.fileName,
            customSubject,
            customMessage,
          })

          if (emailSent) {
            // Update payslip record
            await prisma.payslip.update({
              where: { id: payslip.id },
              data: {
                emailSent: true,
                emailSentAt: new Date(),
              },
            })

            results.emailsSent++
            results.distributionDetails.push({
              employeeCode: employee.employeeCode,
              employeeName,
              email: employee.email,
              status: 'sent',
              sentAt: new Date(),
            })
          } else {
            results.emailsFailed++
            results.errors.push(`Failed to send email to ${employee.employeeCode} (${employee.email})`)
            results.distributionDetails.push({
              employeeCode: employee.employeeCode,
              employeeName,
              email: employee.email,
              status: 'failed',
              error: 'Email sending failed',
            })
          }
        } catch (error) {
          results.emailsFailed++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Error processing ${employee.employeeCode}: ${errorMessage}`)
          results.distributionDetails.push({
            employeeCode: employee.employeeCode,
            employeeName,
            email: employee.email,
            status: 'error',
            error: errorMessage,
          })
        }
      })

      await Promise.all(batchPromises)
      
      // Add delay between batches to avoid overwhelming email service
      if (i + batchSize < payrollRun.payslips.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
      }
    }

    // Log the distribution activity
    console.log(`📧 Payslip distribution completed for payroll run ${payrollRunId}:`, {
      totalPayslips: results.totalPayslips,
      emailsSent: results.emailsSent,
      emailsFailed: results.emailsFailed,
      successRate: `${((results.emailsSent / results.totalPayslips) * 100).toFixed(1)}%`,
    })

    return NextResponse.json({
      message: `Payslip distribution completed. ${results.emailsSent} sent, ${results.emailsFailed} failed.`,
      results,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error distributing payslips:', error)
    return NextResponse.json(
      { error: 'Failed to distribute payslips' },
      { status: 500 }
    )
  }
}

// GET endpoint to check distribution status
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

    const distributionStatus = await prisma.payslip.groupBy({
      by: ['emailSent'],
      where: { payrollRunId },
      _count: {
        id: true,
      },
    })

    const totalPayslips = distributionStatus.reduce((sum, group) => sum + group._count.id, 0)
    const emailsSent = distributionStatus.find(group => group.emailSent)?._count.id || 0
    const emailsPending = distributionStatus.find(group => !group.emailSent)?._count.id || 0

    const recentDistributions = await prisma.payslip.findMany({
      where: {
        payrollRunId,
        emailSent: true,
        emailSentAt: {
          not: null,
        },
      },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        emailSentAt: 'desc',
      },
      take: 10,
    })

    return NextResponse.json({
      distributionStatus: {
        totalPayslips,
        emailsSent,
        emailsPending,
        distributionRate: totalPayslips > 0 ? ((emailsSent / totalPayslips) * 100).toFixed(1) : '0',
      },
      recentDistributions: recentDistributions.map(payslip => ({
        employeeCode: payslip.employee.employeeCode,
        employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
        email: payslip.employee.email,
        sentAt: payslip.emailSentAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching distribution status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch distribution status' },
      { status: 500 }
    )
  }
}
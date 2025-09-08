import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { payslipService, payslipGenerator } from '@/lib/payslip-service'
import { emailService } from '@/lib/email-service'
import { z } from 'zod'

const distributePayslipsSchema = z.object({
  payrollRunId: z.string(),
  employeeIds: z.array(z.string()).optional(),
  emailSubject: z.string().optional(),
  emailMessage: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to distribute payslips
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = distributePayslipsSchema.parse(body)

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id: validatedData.payrollRunId },
      include: {
        payrollRecords: {
          where: {
            status: { in: ['APPROVED', 'PAID'] },
            ...(validatedData.employeeIds && {
              employeeId: { in: validatedData.employeeIds },
            }),
          },
          include: {
            employee: {
              include: {
                department: true,
              },
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
        { error: 'No approved payroll records found for distribution' },
        { status: 400 }
      )
    }

    const results = {
      total: payrollRun.payrollRecords.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Process each employee's payslip
    for (const record of payrollRun.payrollRecords) {
      try {
        // Check if payslip already exists
        let payslip = await prisma.payslip.findFirst({
          where: {
            employeeId: record.employeeId,
            payrollRunId: validatedData.payrollRunId,
          },
        })

        // Generate payslip if it doesn't exist
        if (!payslip) {
          const company = await getCompanyInfo()
          const payslipData = {
            employee: {
              id: record.employee.id,
              employeeCode: record.employee.employeeCode,
              firstName: record.employee.firstName,
              lastName: record.employee.lastName,
              email: record.employee.email,
              designation: record.employee.designation || 'N/A',
              joiningDate: record.employee.joiningDate?.toISOString() || '',
              department: {
                name: record.employee.department?.name || 'N/A',
                code: record.employee.department?.code || 'N/A',
              },
            },
            payrollRun: {
              id: payrollRun.id,
              period: payrollRun.period,
              startDate: payrollRun.startDate.toISOString(),
              endDate: payrollRun.endDate.toISOString(),
            },
            payrollRecord: {
              id: record.id,
              basicSalary: Number(record.basicSalary),
              grossSalary: Number(record.grossSalary),
              netSalary: Number(record.netSalary),
              totalEarnings: Number(record.totalEarnings),
              totalDeductions: Number(record.totalDeductions),
              workingDays: record.workingDays,
              presentDays: Number(record.presentDays),
              absentDays: Number(record.absentDays),
              lopDays: record.lopDays ? Number(record.lopDays) : undefined,
              lopAmount: record.lopAmount ? Number(record.lopAmount) : undefined,
              overtimeHours: record.overtimeHours ? Number(record.overtimeHours) : undefined,
              overtimeAmount: record.overtimeAmount ? Number(record.overtimeAmount) : undefined,
              pfDeduction: record.pfDeduction ? Number(record.pfDeduction) : undefined,
              esiDeduction: record.esiDeduction ? Number(record.esiDeduction) : undefined,
              tdsDeduction: record.tdsDeduction ? Number(record.tdsDeduction) : undefined,
              ptDeduction: record.ptDeduction ? Number(record.ptDeduction) : undefined,
              earnings: (record.earnings as any[]) || [],
              deductions: (record.deductions as any[]) || [],
            },
            company,
          }

          const buffer = await payslipGenerator.generatePayslip(payslipData)
          const fileName = `payslip_${record.employee.employeeCode}_${payrollRun.period}.pdf`

          payslip = await prisma.payslip.create({
            data: {
              employeeId: record.employeeId,
              payrollRunId: validatedData.payrollRunId,
              fileName,
              fileSize: buffer.length,
              generatedBy: session.user.id,
              status: 'GENERATED',
            },
          })
        }

        // Generate payslip buffer for email
        const payslipData = await getPayslipDataForRecord(record, payrollRun)
        const payslipBuffer = await payslipGenerator.generatePayslip(payslipData)

        // Send email with payslip attachment
        const emailSent = await emailService.sendPayslipEmail({
          employeeEmail: record.employee.email,
          employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
          period: payrollRun.period,
          payslipBuffer,
          payslipFileName: payslip.fileName,
          customSubject: validatedData.emailSubject,
          customMessage: validatedData.emailMessage,
        })

        if (emailSent) {
          // Update payslip status
          await prisma.payslip.update({
            where: { id: payslip.id },
            data: {
              emailSent: true,
              emailSentAt: new Date(),
              status: 'SENT',
            },
          })
          results.sent++
        } else {
          results.failed++
          results.errors.push(`Failed to send email to ${record.employee.email}`)
        }
      } catch (error) {
        console.error(`Error processing payslip for employee ${record.employee.employeeCode}:`, error)
        results.failed++
        results.errors.push(`Error processing ${record.employee.employeeCode}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      message: 'Payslip distribution completed',
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

async function getPayslipDataForRecord(record: any, payrollRun: any) {
  const company = await getCompanyInfo()
  
  return {
    employee: {
      id: record.employee.id,
      employeeCode: record.employee.employeeCode,
      firstName: record.employee.firstName,
      lastName: record.employee.lastName,
      email: record.employee.email,
      designation: record.employee.designation || 'N/A',
      joiningDate: record.employee.joiningDate?.toISOString() || '',
      department: {
        name: record.employee.department?.name || 'N/A',
        code: record.employee.department?.code || 'N/A',
      },
    },
    payrollRun: {
      id: payrollRun.id,
      period: payrollRun.period,
      startDate: payrollRun.startDate.toISOString(),
      endDate: payrollRun.endDate.toISOString(),
    },
    payrollRecord: {
      id: record.id,
      basicSalary: Number(record.basicSalary),
      grossSalary: Number(record.grossSalary),
      netSalary: Number(record.netSalary),
      totalEarnings: Number(record.totalEarnings),
      totalDeductions: Number(record.totalDeductions),
      workingDays: record.workingDays,
      presentDays: Number(record.presentDays),
      absentDays: Number(record.absentDays),
      lopDays: record.lopDays ? Number(record.lopDays) : undefined,
      lopAmount: record.lopAmount ? Number(record.lopAmount) : undefined,
      overtimeHours: record.overtimeHours ? Number(record.overtimeHours) : undefined,
      overtimeAmount: record.overtimeAmount ? Number(record.overtimeAmount) : undefined,
      pfDeduction: record.pfDeduction ? Number(record.pfDeduction) : undefined,
      esiDeduction: record.esiDeduction ? Number(record.esiDeduction) : undefined,
      tdsDeduction: record.tdsDeduction ? Number(record.tdsDeduction) : undefined,
      ptDeduction: record.ptDeduction ? Number(record.ptDeduction) : undefined,
      earnings: (record.earnings as any[]) || [],
      deductions: (record.deductions as any[]) || [],
    },
    company,
  }
}

async function getCompanyInfo() {
  return {
    name: 'Pekka HR Solutions',
    address: '123 Business Park, Tech City',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    panNumber: 'ABCDE1234F',
    pfNumber: 'KA/BGE/12345',
    esiNumber: '12345678901234567',
  }
}
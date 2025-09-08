import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { PayrollStatus, PayrollRecordStatus } from '@prisma/client'

const finalizePayrollSchema = z.object({
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE']),
  paymentDate: z.string().datetime(),
  bankFileGenerated: z.boolean().default(false),
  comments: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to finalize payroll
    if (!['ADMIN', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = finalizePayrollSchema.parse(body)

    // Get the payroll run
    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        payrollRecords: {
          where: {
            status: { in: [PayrollRecordStatus.APPROVED, PayrollRecordStatus.CALCULATED] },
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                email: true,
                basicSalary: true,
              },
            },
          },
        },
      },
    })

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    }

    if (payrollRun.status !== PayrollStatus.COMPLETED) {
      return NextResponse.json(
        { error: 'Can only finalize completed and approved payroll runs' },
        { status: 400 }
      )
    }

    if (payrollRun.payrollRecords.length === 0) {
      return NextResponse.json(
        { error: 'No approved payroll records found to finalize' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update all payroll records to PAID status
      await tx.payrollRecord.updateMany({
        where: {
          payrollRunId: id,
          status: { in: [PayrollRecordStatus.APPROVED, PayrollRecordStatus.CALCULATED] },
        },
        data: {
          status: PayrollRecordStatus.PAID,
        },
      })

      // Create payment records for audit trail
      const paymentRecords = payrollRun.payrollRecords.map(record => ({
        employeeId: record.employeeId,
        payrollRecordId: record.id,
        amount: record.netSalary,
        paymentMethod: validatedData.paymentMethod,
        paymentDate: new Date(validatedData.paymentDate),
        status: 'COMPLETED' as const,
        createdBy: session.user.id,
      }))

      // In a real application, you would have a separate PaymentRecord table
      // For now, we'll create audit logs
      for (const payment of paymentRecords) {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'SALARY_PAYMENT',
            resource: 'PAYROLL_RECORD',
            resourceId: payment.payrollRecordId,
            newValues: {
              employeeId: payment.employeeId,
              amount: payment.amount,
              paymentMethod: payment.paymentMethod,
              paymentDate: payment.paymentDate,
              period: payrollRun.period,
            },
          },
        })
      }

      // Update payroll run status
      const updatedRun = await tx.payrollRun.update({
        where: { id },
        data: {
          status: PayrollStatus.COMPLETED,
        },
      })

      // Create finalization audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'PAYROLL_FINALIZED',
          resource: 'PAYROLL_RUN',
          resourceId: id,
          newValues: {
            period: payrollRun.period,
            paymentMethod: validatedData.paymentMethod,
            paymentDate: validatedData.paymentDate,
            employeeCount: payrollRun.payrollRecords.length,
            totalAmount: payrollRun.totalNet,
            bankFileGenerated: validatedData.bankFileGenerated,
            comments: validatedData.comments,
          },
        },
      })

      return {
        payrollRun: updatedRun,
        paymentRecords: paymentRecords.length,
      }
    })

    // Generate bank file if requested (in a real app, this would be a separate service)
    let bankFileData = null
    if (validatedData.paymentMethod === 'BANK_TRANSFER' && validatedData.bankFileGenerated) {
      bankFileData = generateBankFile(payrollRun.payrollRecords, payrollRun.period)
    }

    return NextResponse.json({
      message: 'Payroll finalized successfully',
      payrollRun: result.payrollRun,
      paymentRecords: result.paymentRecords,
      bankFile: bankFileData,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error finalizing payroll:', error)
    return NextResponse.json(
      { error: 'Failed to finalize payroll' },
      { status: 500 }
    )
  }
}

// Helper function to generate bank file format
function generateBankFile(payrollRecords: any[], period: string) {
  // This is a simplified bank file format
  // In a real application, you would generate proper NACH/ACH files
  const records = payrollRecords.map((record, index) => ({
    serialNo: index + 1,
    employeeCode: record.employee.employeeCode,
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
    amount: record.netSalary,
    accountNumber: '1234567890', // This would come from employee bank details
    ifscCode: 'HDFC0000123', // This would come from employee bank details
    period: period,
  }))

  return {
    fileName: `salary_${period.replace('-', '_')}.csv`,
    totalRecords: records.length,
    totalAmount: records.reduce((sum, record) => sum + record.amount, 0),
    records,
  }
}
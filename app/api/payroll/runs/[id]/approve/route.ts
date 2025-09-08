import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { PayrollStatus, PayrollRecordStatus } from '@prisma/client'

const approvePayrollSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().optional(),
  adjustments: z.array(z.object({
    recordId: z.string(),
    adjustmentType: z.enum(['BONUS', 'DEDUCTION', 'CORRECTION']),
    amount: z.number(),
    reason: z.string(),
  })).optional(),
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

    // Check if user has permission to approve payroll
    if (!['ADMIN', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { action, comments, adjustments } = approvePayrollSchema.parse(body)

    // Get the payroll run
    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        payrollRecords: {
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
        },
      },
    })

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    }

    if (payrollRun.status !== PayrollStatus.COMPLETED) {
      return NextResponse.json(
        { error: 'Can only approve completed payroll runs' },
        { status: 400 }
      )
    }

    if (action === 'reject') {
      // Reject the payroll run
      const updatedRun = await prisma.payrollRun.update({
        where: { id },
        data: {
          status: PayrollStatus.FAILED,
        },
      })

      // Update all payroll records to draft status
      await prisma.payrollRecord.updateMany({
        where: { payrollRunId: id },
        data: {
          status: PayrollRecordStatus.DRAFT,
        },
      })

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'PAYROLL_REJECTED',
          resource: 'PAYROLL_RUN',
          resourceId: id,
          newValues: {
            comments,
            period: payrollRun.period,
          },
        },
      })

      return NextResponse.json({
        message: 'Payroll run rejected successfully',
        payrollRun: updatedRun,
      })
    }

    // Approve the payroll run with optional adjustments
    const result = await prisma.$transaction(async (tx) => {
      // Apply adjustments if provided
      if (adjustments && adjustments.length > 0) {
        for (const adjustment of adjustments) {
          const record = await tx.payrollRecord.findUnique({
            where: { id: adjustment.recordId },
          })

          if (!record) {
            throw new Error(`Payroll record ${adjustment.recordId} not found`)
          }

          // Calculate new net salary based on adjustment
          let newNetSalary = record.netSalary.toNumber()
          if (adjustment.adjustmentType === 'BONUS') {
            newNetSalary += adjustment.amount
          } else if (adjustment.adjustmentType === 'DEDUCTION') {
            newNetSalary -= adjustment.amount
          } else if (adjustment.adjustmentType === 'CORRECTION') {
            // For corrections, the amount is the new net salary
            newNetSalary = adjustment.amount
          }

          // Update the payroll record
          await tx.payrollRecord.update({
            where: { id: adjustment.recordId },
            data: {
              netSalary: newNetSalary,
              status: PayrollRecordStatus.APPROVED,
            },
          })

          // Create adjustment record for audit trail
          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              action: 'PAYROLL_ADJUSTMENT',
              resource: 'PAYROLL_RECORD',
              resourceId: adjustment.recordId,
              oldValues: {
                netSalary: record.netSalary,
              },
              newValues: {
                netSalary: newNetSalary,
                adjustmentType: adjustment.adjustmentType,
                adjustmentAmount: adjustment.amount,
                reason: adjustment.reason,
              },
            },
          })
        }
      } else {
        // Approve all records without adjustments
        await tx.payrollRecord.updateMany({
          where: { payrollRunId: id },
          data: {
            status: PayrollRecordStatus.APPROVED,
            approvedBy: session.user.id,
            approvedAt: new Date(),
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

      // Recalculate totals if adjustments were made
      if (adjustments && adjustments.length > 0) {
        const updatedRecords = await tx.payrollRecord.findMany({
          where: { payrollRunId: id },
        })

        const totalGross = updatedRecords.reduce((sum, record) => sum + record.grossSalary.toNumber(), 0)
        const totalNet = updatedRecords.reduce((sum, record) => sum + record.netSalary.toNumber(), 0)
        const totalDeductions = updatedRecords.reduce((sum, record) => sum + record.totalDeductions.toNumber(), 0)

        await tx.payrollRun.update({
          where: { id },
          data: {
            totalGross,
            totalNet,
            totalDeductions,
          },
        })
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'PAYROLL_APPROVED',
          resource: 'PAYROLL_RUN',
          resourceId: id,
          newValues: {
            comments,
            period: payrollRun.period,
            adjustmentsCount: adjustments?.length || 0,
          },
        },
      })

      return updatedRun
    })

    // Send notifications to HR and employees (in a real app, this would be done via a queue)
    // For now, we'll just log it
    console.log(`Payroll approved for period ${payrollRun.period}`)

    return NextResponse.json({
      message: 'Payroll run approved successfully',
      payrollRun: result,
      adjustmentsApplied: adjustments?.length || 0,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing payroll approval:', error)
    return NextResponse.json(
      { error: 'Failed to process payroll approval' },
      { status: 500 }
    )
  }
}
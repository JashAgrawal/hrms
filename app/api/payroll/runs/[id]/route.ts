import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { PayrollStatus } from '@prisma/client'

const updatePayrollRunSchema = z.object({
  status: z.nativeEnum(PayrollStatus).optional(),
  description: z.string().optional(),
})

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

    // Check if user has permission to view payroll runs
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

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
                designation: true,
                department: {
                  select: {
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { employee: { employeeCode: 'asc' } },
          ],
        },
        _count: {
          select: {
            payrollRecords: true,
          },
        },
      },
    })

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    }

    return NextResponse.json(payrollRun)
  } catch (error) {
    console.error('Error fetching payroll run:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payroll run' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update payroll runs
    if (!['ADMIN', 'HR', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updatePayrollRunSchema.parse(body)

    // Check if payroll run exists
    const existingRun = await prisma.payrollRun.findUnique({
      where: { id },
    })

    if (!existingRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    }

    // Validate status transitions
    if (validatedData.status) {
      const validTransitions: Record<PayrollStatus, PayrollStatus[]> = {
        [PayrollStatus.DRAFT]: [PayrollStatus.PROCESSING, PayrollStatus.CANCELLED],
        [PayrollStatus.PROCESSING]: [PayrollStatus.COMPLETED, PayrollStatus.FAILED],
        [PayrollStatus.COMPLETED]: [], // No transitions allowed from completed
        [PayrollStatus.FAILED]: [PayrollStatus.DRAFT], // Can reset to draft
        [PayrollStatus.CANCELLED]: [PayrollStatus.DRAFT], // Can reset to draft
      }

      const allowedTransitions = validTransitions[existingRun.status]
      if (!allowedTransitions.includes(validatedData.status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${existingRun.status} to ${validatedData.status}` },
          { status: 400 }
        )
      }
    }

    const updatedRun = await prisma.payrollRun.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(updatedRun)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating payroll run:', error)
    return NextResponse.json(
      { error: 'Failed to update payroll run' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete payroll runs
    if (!['ADMIN', 'FINANCE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if payroll run exists
    const existingRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            payrollRecords: true,
          },
        },
      },
    })

    if (!existingRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    }

    // Only allow deletion of draft or failed runs
    if (!['DRAFT', 'FAILED'].includes(existingRun.status)) {
      return NextResponse.json(
        { error: 'Can only delete draft or failed payroll runs' },
        { status: 400 }
      )
    }

    // Delete payroll records first, then the run
    await prisma.$transaction(async (tx) => {
      await tx.payrollRecord.deleteMany({
        where: { payrollRunId: id },
      })

      await tx.payrollRun.delete({
        where: { id },
      })
    })

    return NextResponse.json({ message: 'Payroll run deleted successfully' })
  } catch (error) {
    console.error('Error deleting payroll run:', error)
    return NextResponse.json(
      { error: 'Failed to delete payroll run' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bulkActionSchema = z.object({
  action: z.enum(['ACTIVATE', 'DEACTIVATE', 'ON_LEAVE', 'DELETE']),
  employeeIds: z.array(z.string()).min(1, 'At least one employee must be selected'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission for bulk actions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { action, employeeIds } = bulkActionSchema.parse(body)

    // Get current employee data for audit log
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        status: true,
        userId: true,
      }
    })

    if (employees.length !== employeeIds.length) {
      return NextResponse.json(
        { error: 'Some employees not found' },
        { status: 404 }
      )
    }

    // Perform bulk action in transaction
    const result = await prisma.$transaction(async (tx) => {
      let updateData: { status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED' } = {}
      let userUpdateData: { isActive?: boolean } = {}

      switch (action) {
        case 'ACTIVATE':
          updateData = { status: 'ACTIVE' }
          userUpdateData = { isActive: true }
          break
        case 'DEACTIVATE':
          updateData = { status: 'INACTIVE' }
          userUpdateData = { isActive: false }
          break
        case 'ON_LEAVE':
          updateData = { status: 'ON_LEAVE' }
          break
        case 'DELETE':
          updateData = { status: 'TERMINATED' }
          userUpdateData = { isActive: false }
          break
      }

      // Update employees
      const updatedEmployees = await tx.employee.updateMany({
        where: { id: { in: employeeIds } },
        data: updateData
      })

      // Update users if needed
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.updateMany({
          where: { id: { in: employees.map(e => e.userId) } },
          data: userUpdateData
        })
      }

      // Create audit logs for each employee
      const auditLogs = employees.map(employee => ({
        userId: session.user.id,
        action: 'BULK_UPDATE',
        resource: 'EMPLOYEE',
        resourceId: employee.id,
        oldValues: {
          status: employee.status,
        },
        newValues: {
          status: updateData.status || employee.status,
          action: action,
        }
      }))

      await tx.auditLog.createMany({
        data: auditLogs
      })

      return { count: updatedEmployees.count }
    })

    return NextResponse.json({
      message: `Successfully ${action.toLowerCase()}d ${result.count} employee(s)`,
      count: result.count
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Bulk action error:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    )
  }
}
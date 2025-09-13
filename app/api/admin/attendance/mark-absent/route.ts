import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { 
  markAbsentForMissingCheckout,
  markEmployeeAbsentForMissingCheckout,
  getAbsenceMarkingPreview
} from '@/lib/jobs/attendance-absence-scheduler'

const markAbsentSchema = z.object({
  targetDate: z.string().datetime().optional(),
  employeeId: z.string().optional(), // For marking specific employee
  reason: z.string().optional(),
  preview: z.boolean().default(false), // For preview mode
})

// POST /api/admin/attendance/mark-absent - Mark employees absent for missing checkout
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin or HR permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Admin or HR role required.' 
      }, { status: 403 })
    }

    const body = await request.json()
    const data = markAbsentSchema.parse(body)

    const targetDate = data.targetDate ? new Date(data.targetDate) : new Date()

    // Preview mode - just return what would be processed
    if (data.preview) {
      const preview = await getAbsenceMarkingPreview(targetDate)
      return NextResponse.json({
        success: true,
        preview: true,
        ...preview,
        message: `Found ${preview.eligibleForMarking} employees eligible for absence marking`
      })
    }

    // Single employee mode
    if (data.employeeId) {
      const result = await markEmployeeAbsentForMissingCheckout(
        data.employeeId,
        targetDate,
        data.reason
      )
      
      if (result.success) {
        // Log the manual action
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'ATTENDANCE_MANUAL_ABSENT_TRIGGER',
            resource: 'ATTENDANCE',
            resourceId: data.employeeId,
            newValues: {
              targetDate: targetDate.toISOString(),
              reason: data.reason || 'Missing checkout by end of day',
              triggeredBy: user.employee?.firstName + ' ' + user.employee?.lastName,
            },
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
        })
      }

      return NextResponse.json(result)
    }

    // Bulk processing mode
    const result = await markAbsentForMissingCheckout(targetDate)

    // Log the bulk action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ATTENDANCE_BULK_ABSENT_TRIGGER',
        resource: 'ATTENDANCE',
        resourceId: 'BULK_OPERATION',
        newValues: {
          targetDate: targetDate.toISOString(),
          processedCount: result.processed,
          successfulCount: result.summary.successful,
          failedCount: result.summary.failed,
          skippedCount: result.summary.skipped,
          triggeredBy: user.employee?.firstName + ' ' + user.employee?.lastName,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({
      message: result.success
        ? `Successfully processed ${result.processed} attendance records. ${result.summary.successful} marked absent, ${result.summary.failed} failed, ${result.summary.skipped} skipped.`
        : 'Failed to process attendance records',
      ...result,
    })

  } catch (error) {
    console.error('Error in mark absent API:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/admin/attendance/mark-absent - Get preview of what would be marked absent
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin or HR permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Admin or HR role required.' 
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const targetDateParam = searchParams.get('targetDate')
    const targetDate = targetDateParam ? new Date(targetDateParam) : new Date()

    const preview = await getAbsenceMarkingPreview(targetDate)

    return NextResponse.json({
      success: true,
      targetDate: targetDate.toISOString(),
      ...preview,
    })

  } catch (error) {
    console.error('Error in mark absent preview API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

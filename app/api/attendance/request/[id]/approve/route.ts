import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/email-service'
import { z } from 'zod'

// Schema for attendance request approval
const approvalSchema = z.object({
  approved: z.boolean(),
  comments: z.string().optional()
})

// POST /api/attendance/request/[id]/approve - Approve or reject attendance request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const requestId = id
    const body = await request.json()
    const data = approvalSchema.parse(body)

    // Get user's employee record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has permission to approve attendance requests (HR/Admin/Manager)
    const canApprove = user.role === 'ADMIN' || 
                      user.role === 'HR' || 
                      user.role === 'MANAGER'

    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the attendance request
    const attendanceRequest = await prisma.attendanceRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: {
          include: {
            user: true
          }
        }
      }
    })

    if (!attendanceRequest) {
      return NextResponse.json({ error: 'Attendance request not found' }, { status: 404 })
    }

    if (attendanceRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Attendance request has already been processed' },
        { status: 400 }
      )
    }

    const now = new Date()
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    if (data.approved) {
      // Approve the request and create attendance record
      const updatedRequest = await prisma.attendanceRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedBy: session.user.id,
          approvedAt: now
        }
      })

      // Create attendance record for the approved request
      const attendanceRecord = await prisma.attendanceRecord.upsert({
        where: {
          employeeId_date: {
            employeeId: attendanceRequest.employeeId,
            date: attendanceRequest.date
          }
        },
        update: {
          checkIn: attendanceRequest.checkInTime,
          status: 'PRESENT',
          method: 'GPS',
          location: attendanceRequest.location as any,
          notes: `Approved out-of-location check-in. ${data.comments || ''}`.trim(),
          approvedBy: session.user.id,
          approvedAt: now,
          updatedAt: now
        },
        create: {
          employeeId: attendanceRequest.employeeId,
          date: attendanceRequest.date,
          checkIn: attendanceRequest.checkInTime,
          status: 'PRESENT',
          method: 'GPS',
          location: attendanceRequest.location as any,
          notes: `Approved out-of-location check-in. ${data.comments || ''}`.trim(),
          approvedBy: session.user.id,
          approvedAt: now
        }
      })

      // Create check-in record
      await prisma.checkInOut.create({
        data: {
          attendanceId: attendanceRecord.id,
          employeeId: attendanceRequest.employeeId,
          type: 'CHECK_IN',
          timestamp: attendanceRequest.checkInTime,
          location: attendanceRequest.location as any,
          method: 'GPS',
          isManualEntry: true,
          manualReason: 'Approved out-of-location check-in',
          approvedBy: session.user.id,
          ipAddress: clientIP
        }
      })

      // Log the approval
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'APPROVE_ATTENDANCE_REQUEST',
          resource: 'ATTENDANCE_REQUEST',
          resourceId: requestId,
          newValues: {
            approved: true,
            approvedBy: session.user.id,
            approvedAt: now,
            comments: data.comments,
            attendanceRecordId: attendanceRecord.id
          },
          ipAddress: clientIP,
          userAgent: request.headers.get('user-agent')
        }
      })

      // Send email notification to employee
      try {
        if (attendanceRequest.employee.user?.email) {
          await emailService.sendEmail({
            to: attendanceRequest.employee.user.email,
            subject: 'Attendance Request Approved',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">✅ Attendance Request Approved</h2>
                <p>Hi ${attendanceRequest.employee.firstName},</p>
                <p>Your attendance request for <strong>${attendanceRequest.date.toDateString()}</strong> has been approved.</p>
                ${data.comments ? `<p><strong>Comments:</strong> ${data.comments}</p>` : ''}
                <p>Your attendance has been recorded for the requested date.</p>
                <p>Best regards,<br>HR Team</p>
              </div>
            `,
            text: `Hi ${attendanceRequest.employee.firstName}, Your attendance request for ${attendanceRequest.date.toDateString()} has been approved. ${data.comments ? `Comments: ${data.comments}` : ''}`
          })
        }
      } catch (error) {
        console.warn('Failed to send attendance approval email:', error)
      }

      return NextResponse.json({
        success: true,
        attendanceRequest: updatedRequest,
        attendanceRecord,
        message: 'Attendance request approved successfully'
      })

    } else {
      // Reject the request
      const updatedRequest = await prisma.attendanceRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectedAt: now,
          rejectionReason: data.comments || 'Request rejected'
        }
      })

      // Log the rejection
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'REJECT_ATTENDANCE_REQUEST',
          resource: 'ATTENDANCE_REQUEST',
          resourceId: requestId,
          newValues: {
            approved: false,
            rejectedAt: now,
            rejectionReason: data.comments || 'Request rejected'
          },
          ipAddress: clientIP,
          userAgent: request.headers.get('user-agent')
        }
      })

      // Send email notification to employee
      try {
        if (attendanceRequest.employee.user?.email) {
          await emailService.sendEmail({
            to: attendanceRequest.employee.user.email,
            subject: 'Attendance Request Rejected',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc3545;">❌ Attendance Request Rejected</h2>
                <p>Hi ${attendanceRequest.employee.firstName},</p>
                <p>Your attendance request for <strong>${attendanceRequest.date.toDateString()}</strong> has been rejected.</p>
                <p><strong>Reason:</strong> ${data.comments || 'No specific reason provided'}</p>
                <p>Please contact your manager or HR for more information.</p>
                <p>Best regards,<br>HR Team</p>
              </div>
            `,
            text: `Hi ${attendanceRequest.employee.firstName}, Your attendance request for ${attendanceRequest.date.toDateString()} has been rejected. Reason: ${data.comments || 'No specific reason provided'}`
          })
        }
      } catch (error) {
        console.warn('Failed to send attendance rejection email:', error)
      }

      return NextResponse.json({
        success: true,
        attendanceRequest: updatedRequest,
        message: 'Attendance request rejected'
      })
    }

  } catch (error) {
    console.error('Error processing attendance request:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process attendance request' },
      { status: 500 }
    )
  }
}
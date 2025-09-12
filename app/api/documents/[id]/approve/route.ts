import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const approvalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional(),
  digitalSignature: z.object({
    signature: z.string(),
    timestamp: z.string(),
    certificate: z.string().optional()
  }).optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const documentId = id
    const body = await request.json()
    const validatedData = approvalSchema.parse(body)

    // Get document with current approvals
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        approvals: {
          orderBy: { level: 'asc' }
        },
        employee: {
          include: { user: true }
        }
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Get current user details
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has permission to approve
    const canApprove = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      (currentUser.employee && document.employee?.reportingTo === currentUser.employee.id)

    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find the current approval level for this user
    let currentApproval = document.approvals.find(
      approval => approval.approverId === session.user.id && approval.status === 'PENDING'
    )

    // If no existing approval, create one
    if (!currentApproval) {
      const nextLevel = Math.max(...document.approvals.map(a => a.level), 0) + 1
      currentApproval = await prisma.documentApproval.create({
        data: {
          documentId,
          approverId: session.user.id,
          approverName: currentUser.name || currentUser.email,
          approverEmail: currentUser.email,
          level: nextLevel,
          status: 'PENDING'
        }
      })
    }

    // Update the approval
    const updatedApproval = await prisma.documentApproval.update({
      where: { id: currentApproval.id },
      data: {
        status: validatedData.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approvedAt: validatedData.action === 'APPROVE' ? new Date() : null,
        rejectedAt: validatedData.action === 'REJECT' ? new Date() : null,
        comments: validatedData.comments,
        digitalSignature: validatedData.digitalSignature ? JSON.stringify(validatedData.digitalSignature) : Prisma.JsonNull
      }
    })

    // Update document approval status
    let documentApprovalStatus = document.approvalStatus
    if (validatedData.action === 'REJECT') {
      documentApprovalStatus = 'REJECTED'
    } else if (validatedData.action === 'APPROVE') {
      // Check if all required approvals are complete
      const allApprovals = await prisma.documentApproval.findMany({
        where: { documentId }
      })
      const allApproved = allApprovals.every(approval => approval.status === 'APPROVED')
      if (allApproved) {
        documentApprovalStatus = 'APPROVED'
      }
    }

    // Update document
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        approvalStatus: documentApprovalStatus
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: validatedData.action === 'APPROVE' ? 'APPROVE' : 'REJECT',
        resource: 'DOCUMENT',
        resourceId: documentId,
        newValues: {
          approvalStatus: documentApprovalStatus,
          comments: validatedData.comments
        }
      }
    })

    // Log document access
    await prisma.documentAccessLog.create({
      data: {
        documentId,
        userId: session.user.id,
        userName: currentUser.name || currentUser.email,
        action: validatedData.action === 'APPROVE' ? 'APPROVE' : 'REJECT',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      approval: updatedApproval,
      document: updatedDocument
    })
  } catch (error) {
    console.error('Error processing document approval:', error)
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
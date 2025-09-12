import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const shareSchema = z.object({
  sharedWith: z.string().min(1, 'Shared with is required'),
  permissions: z.enum(['READ', 'WRITE', 'ADMIN']).default('READ'),
  expiresAt: z.string().datetime().optional()
})

export async function GET(
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

    // Get document shares
    const shares = await prisma.documentShare.findMany({
      where: { 
        documentId,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ shares })
  } catch (error) {
    console.error('Error fetching document shares:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const validatedData = shareSchema.parse(body)

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        employee: true
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const canShare = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      document.employee?.userId === session.user.id ||
      (currentUser.employee && document.employee?.reportingTo === currentUser.employee.id)

    if (!canShare) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if user/email exists
    let sharedWithUser = null
    if (validatedData.sharedWith.includes('@')) {
      // Email provided
      sharedWithUser = await prisma.user.findUnique({
        where: { email: validatedData.sharedWith }
      })
    } else {
      // User ID provided
      sharedWithUser = await prisma.user.findUnique({
        where: { id: validatedData.sharedWith }
      })
    }

    if (!sharedWithUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already shared
    const existingShare = await prisma.documentShare.findFirst({
      where: {
        documentId,
        sharedWith: sharedWithUser.id,
        isActive: true
      }
    })

    if (existingShare) {
      return NextResponse.json({ error: 'Document already shared with this user' }, { status: 400 })
    }

    // Create share record
    const share = await prisma.documentShare.create({
      data: {
        documentId,
        sharedWith: sharedWithUser.id,
        sharedBy: session.user.id,
        permissions: validatedData.permissions.toUpperCase() as any,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SHARE',
        resource: 'DOCUMENT',
        resourceId: documentId,
        newValues: {
          sharedWith: sharedWithUser.email,
          permissions: validatedData.permissions
        }
      }
    })

    // Log document access
    await prisma.documentAccessLog.create({
      data: {
        documentId,
        userId: session.user.id,
        userName: currentUser.name || currentUser.email,
        action: 'SHARE',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({ share }, { status: 201 })
  } catch (error) {
    console.error('Error sharing document:', error)
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

export async function DELETE(
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
    const { searchParams } = new URL(request.url)
    const shareId = searchParams.get('shareId')

    if (!shareId) {
      return NextResponse.json({ error: 'Share ID is required' }, { status: 400 })
    }

    // Get share record
    const share = await prisma.documentShare.findUnique({
      where: { id: shareId },
      include: {
        document: {
          include: { employee: true }
        }
      }
    })

    if (!share || share.documentId !== documentId) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const canUnshare = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      share.sharedBy === session.user.id ||
      share.document.employee?.userId === session.user.id

    if (!canUnshare) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Deactivate share
    await prisma.documentShare.update({
      where: { id: shareId },
      data: { isActive: false }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UNSHARE',
        resource: 'DOCUMENT',
        resourceId: documentId,
        oldValues: {
          shareId,
          sharedWith: share.sharedWith
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing document share:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
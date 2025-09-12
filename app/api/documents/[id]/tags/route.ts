import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const tagsSchema = z.object({
  tags: z.array(z.string().min(1)).max(10, 'Maximum 10 tags allowed')
})

export async function PUT(
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
    const validatedData = tagsSchema.parse(body)

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

    const canUpdateTags = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      document.employee?.userId === session.user.id ||
      (currentUser.employee && document.employee?.reportingTo === currentUser.employee.id)

    if (!canUpdateTags) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Clean and validate tags
    const cleanTags = validatedData.tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .filter((tag, index, self) => self.indexOf(tag) === index) // Remove duplicates

    // Update document tags
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        tags: JSON.stringify(cleanTags)
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        resource: 'DOCUMENT',
        resourceId: documentId,
        oldValues: {
          tags: document.tags
        },
        newValues: {
          tags: cleanTags
        }
      }
    })

    // Log document access
    await prisma.documentAccessLog.create({
      data: {
        documentId,
        userId: session.user.id,
        userName: currentUser.name || currentUser.email,
        action: 'UPDATE',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({ 
      document: updatedDocument,
      tags: cleanTags
    })
  } catch (error) {
    console.error('Error updating document tags:', error)
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

    // Get document tags
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        tags: true,
        employeeId: true,
        employee: {
          select: {
            userId: true,
            reportingTo: true
          }
        }
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

    const canViewTags = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      document.employee?.userId === session.user.id ||
      (currentUser.employee && document.employee?.reportingTo === currentUser.employee.id)

    if (!canViewTags) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tags = document.tags ? JSON.parse(document.tags as string) : []

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Error fetching document tags:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
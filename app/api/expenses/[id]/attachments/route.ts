import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    // Get expense claim
    const expenseClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      include: { employee: true }
    })

    if (!expenseClaim) {
      return NextResponse.json({ error: 'Expense claim not found' }, { status: 404 })
    }

    // Check if user owns the expense claim
    if (expenseClaim.employee.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if expense is still editable
    if (expenseClaim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot modify attachments for non-pending expense claims' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const attachments = []

    for (const file of files) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `File type ${file.type} is not allowed` },
          { status: 400 }
        )
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} is too large. Maximum size is 5MB` },
          { status: 400 }
        )
      }

      // In a real implementation, you would upload to a cloud storage service
      // For now, we'll simulate the upload and store metadata
      const fileUrl = `/uploads/expenses/${resolvedParams.id}/${Date.now()}-${file.name}`

      const attachment = await prisma.expenseAttachment.create({
        data: {
          expenseId: resolvedParams.id,
          fileName: file.name,
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          fileUrl: fileUrl
        }
      })

      attachments.push(attachment)
    }

    return NextResponse.json(attachments, { status: 201 })
  } catch (error) {
    console.error('Error uploading attachments:', error)
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
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    // Get expense claim with attachments
    const expenseClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      include: {
        employee: true,
        attachments: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!expenseClaim) {
      return NextResponse.json({ error: 'Expense claim not found' }, { status: 404 })
    }

    // Check access permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    const canAccess = 
      expenseClaim.employee.userId === session.user.id || // Owner
      user?.role === 'ADMIN' || // Admin
      user?.role === 'HR' || // HR
      user?.role === 'FINANCE' || // Finance
      (user?.employee && expenseClaim.employee.reportingTo === user.employee.id) // Manager

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(expenseClaim.attachments)
  } catch (error) {
    console.error('Error fetching attachments:', error)
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
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 })
    }

    // Get expense claim and attachment
    const expenseClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      include: { employee: true }
    })

    if (!expenseClaim) {
      return NextResponse.json({ error: 'Expense claim not found' }, { status: 404 })
    }

    // Check if user owns the expense claim
    if (expenseClaim.employee.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if expense is still editable
    if (expenseClaim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot modify attachments for non-pending expense claims' },
        { status: 400 }
      )
    }

    // Delete attachment
    await prisma.expenseAttachment.delete({
      where: {
        id: attachmentId,
        expenseId: resolvedParams.id
      }
    })

    return NextResponse.json({ message: 'Attachment deleted successfully' })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

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

    // Get document versions
    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' }
    })

    return NextResponse.json({ versions })
  } catch (error) {
    console.error('Error fetching document versions:', error)
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
    const formData = await request.formData()
    const file = formData.get('file') as File
    const changeLog = formData.get('changeLog') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Get original document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        employee: true,
        versions: {
          orderBy: { version: 'desc' },
          take: 1
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

    const canUpdate = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      document.employee?.userId === session.user.id ||
      (currentUser.employee && document.employee?.reportingTo === currentUser.employee.id)

    if (!canUpdate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate file type and size
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'documents', document.employeeId || 'system')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate unique filename for new version
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const newVersion = (document.versions[0]?.version || document.version) + 1
    const filename = `${timestamp}-v${newVersion}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filepath = join(uploadDir, filename)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Create new version record
    const documentVersion = await prisma.documentVersion.create({
      data: {
        documentId,
        version: newVersion,
        fileName: filename,
        fileUrl: `/uploads/documents/${document.employeeId || 'system'}/${filename}`,
        fileSize: file.size,
        mimeType: file.type,
        changeLog,
        uploadedBy: session.user.id
      }
    })

    // Update main document with new version info
    await prisma.document.update({
      where: { id: documentId },
      data: {
        version: newVersion,
        fileName: filename,
        fileUrl: `/uploads/documents/${document.employeeId || 'system'}/${filename}`,
        fileSize: file.size,
        mimeType: file.type,
        approvalStatus: 'PENDING' // Reset approval status for new version
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        resource: 'DOCUMENT',
        resourceId: documentId,
        newValues: {
          version: newVersion,
          fileName: filename,
          changeLog
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

    return NextResponse.json({ version: documentVersion }, { status: 201 })
  } catch (error) {
    console.error('Error creating document version:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
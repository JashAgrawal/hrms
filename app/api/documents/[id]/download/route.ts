import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentSecurityService } from '@/lib/document-security-service'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let userId: string | undefined
  let documentId = id

  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    // Verify access token if provided
    if (token) {
      const tokenData = DocumentSecurityService.verifyAccessToken(token)
      if (!tokenData || tokenData.documentId !== documentId) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
      }
      userId = tokenData.userId
    } else if (session?.user) {
      userId = session.user.id
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get document details
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        employee: {
          include: { user: true }
        }
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check if document is active and not expired
    if (!document.isActive || document.status !== 'ACTIVE') {
      await DocumentSecurityService.logDocumentAccess(
        documentId,
        userId,
        'DOWNLOAD',
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown',
        false,
        'Document is not active'
      )
      return NextResponse.json({ error: 'Document is not available' }, { status: 403 })
    }

    // Check if document has expired
    if (DocumentSecurityService.isDocumentExpired(document)) {
      await DocumentSecurityService.logDocumentAccess(
        documentId,
        userId,
        'DOWNLOAD',
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown',
        false,
        'Document has expired'
      )
      return NextResponse.json({ error: 'Document has expired' }, { status: 403 })
    }

    // Check download permissions
    const hasAccess = await DocumentSecurityService.checkDocumentAccess(
      documentId,
      userId,
      'DOWNLOAD'
    )

    if (!hasAccess) {
      await DocumentSecurityService.logDocumentAccess(
        documentId,
        userId,
        'DOWNLOAD',
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown',
        false,
        'Access denied'
      )
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get security settings (in a real app, this would be from database)
    const securitySettings = {
      encryptionEnabled: true,
      watermarkEnabled: false,
      downloadRestrictions: false
    }

    try {
      // Read file from storage
      const filePath = join(process.cwd(), 'public', document.fileUrl)
      let fileBuffer = await readFile(filePath)

      // Apply watermark if enabled
      if (securitySettings.watermarkEnabled) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { employee: true }
        })

        const watermarkText = `${user?.name || user?.email} - ${new Date().toISOString()}`
        
        fileBuffer = await DocumentSecurityService.applyWatermark(
          fileBuffer,
          document.mimeType || 'application/octet-stream',
          {
            text: watermarkText,
            position: 'bottom-right',
            opacity: 0.3,
            fontSize: 12,
            color: '#666666'
          }
        )
      }

      // Log successful access
      await DocumentSecurityService.logDocumentAccess(
        documentId,
        userId,
        'DOWNLOAD',
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown',
        true
      )

      // Update access count if document is shared
      await prisma.documentShare.updateMany({
        where: {
          documentId,
          sharedWith: userId,
          isActive: true
        },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date()
        }
      })

      // Set appropriate headers
      const headers = new Headers()
      headers.set('Content-Type', document.mimeType || 'application/octet-stream')
      headers.set('Content-Length', fileBuffer.length.toString())
      headers.set('Content-Disposition', `attachment; filename="${document.originalName || document.fileName}"`)
      
      // Add security headers
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('X-Frame-Options', 'DENY')
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      headers.set('Pragma', 'no-cache')
      headers.set('Expires', '0')

      return new NextResponse(fileBuffer as BodyInit, {
        status: 200,
        headers
      })

    } catch (fileError) {
      console.error('Error reading file:', fileError)
      
      await DocumentSecurityService.logDocumentAccess(
        documentId,
        userId,
        'DOWNLOAD',
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown',
        false,
        'File not found or corrupted'
      )

      return NextResponse.json({ error: 'File not found or corrupted' }, { status: 404 })
    }

  } catch (error) {
    console.error('Error downloading document:', error)
    
    if (userId) {
      await DocumentSecurityService.logDocumentAccess(
        documentId,
        userId,
        'DOWNLOAD',
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown',
        false,
        'Internal server error'
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
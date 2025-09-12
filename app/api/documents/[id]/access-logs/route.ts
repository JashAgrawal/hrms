import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    // Get document to check permissions
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

    const canViewLogs = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      document.employee?.userId === session.user.id ||
      (currentUser.employee && document.employee?.reportingTo === currentUser.employee.id)

    if (!canViewLogs) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get access logs
    const logs = await prisma.documentAccessLog.findMany({
      where: { documentId },
      orderBy: { timestamp: 'desc' },
      take: 100 // Limit to last 100 logs
    })

    // Log this access
    await prisma.documentAccessLog.create({
      data: {
        documentId,
        userId: session.user.id,
        userName: currentUser.name || currentUser.email,
        action: 'VIEW',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Error fetching document access logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
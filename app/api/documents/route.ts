import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const approvalStatus = searchParams.get('approvalStatus')
    const employeeId = searchParams.get('employeeId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const expiredOnly = searchParams.get('expiredOnly') === 'true'
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build where clause
    const where: any = {}

    // Role-based access control
    if (!['ADMIN', 'HR'].includes(currentUser.role)) {
      // Non-admin users can only see their own documents or shared documents
      where.OR = [
        { employeeId: currentUser.employee?.id },
        {
          shares: {
            some: {
              sharedWith: session.user.id,
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          }
        }
      ]
    }

    // Search filters
    if (search) {
      where.OR = [
        ...(where.OR || []),
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (category && category !== 'all') {
      where.category = category
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (approvalStatus && approvalStatus !== 'all') {
      where.approvalStatus = approvalStatus
    }

    if (employeeId && employeeId !== 'all') {
      where.employeeId = employeeId
    }

    if (dateFrom) {
      where.createdAt = { ...where.createdAt, gte: new Date(dateFrom) }
    }

    if (dateTo) {
      where.createdAt = { ...where.createdAt, lte: new Date(dateTo) }
    }

    if (tags && tags.length > 0) {
      // Search for documents that have any of the specified tags
      where.tags = {
        path: '$',
        array_contains: tags
      }
    }

    if (expiredOnly) {
      where.expiryDate = {
        lt: new Date()
      }
      where.status = 'ACTIVE'
    }

    // Only active documents by default
    if (!where.status) {
      where.isActive = true
    }

    // Build orderBy
    const orderBy: any = {}
    if (sortBy === 'employeeName') {
      orderBy.employee = {
        firstName: sortOrder
      }
    } else {
      orderBy[sortBy] = sortOrder
    }

    // Get documents with pagination
    const [documents, totalCount] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          versions: {
            orderBy: { version: 'desc' },
            take: 1
          },
          approvals: {
            where: { status: 'PENDING' },
            orderBy: { level: 'asc' }
          },
          shares: {
            where: { isActive: true },
            take: 5
          },
          reminders: {
            where: { isActive: true },
            orderBy: { reminderDate: 'asc' },
            take: 3
          }
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.document.count({ where })
    ])

    // Log search activity for analytics
    if (search || category !== 'all' || status !== 'all') {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'SEARCH',
          resource: 'DOCUMENT',
          newValues: {
            search,
            category,
            status,
            approvalStatus,
            employeeId,
            resultsCount: documents.length
          }
        }
      })
    }

    return NextResponse.json({
      documents,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // This endpoint is for creating documents programmatically
    // The main upload functionality is in /api/documents/upload
    
    const body = await request.json()
    const {
      employeeId,
      title,
      description,
      category,
      fileUrl,
      fileName,
      originalName,
      fileSize,
      mimeType,
      tags,
      expiryDate,
      isRequired
    } = body

    // Validate required fields
    if (!title || !category || !fileUrl || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const canCreate = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      (employeeId && employeeId === currentUser.employee?.id)

    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Create document
    const document = await prisma.document.create({
      data: {
        employeeId: employeeId || null,
        title,
        description,
        category,
        fileName,
        originalName,
        fileUrl,
        fileSize,
        mimeType,
        tags: tags ? JSON.stringify(tags) : Prisma.JsonNull,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isRequired: isRequired || false,
        uploadedBy: session.user.id,
        status: 'ACTIVE',
        approvalStatus: 'PENDING'
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        resource: 'DOCUMENT',
        resourceId: document.id,
        newValues: {
          title: document.title,
          category: document.category,
          employeeId: document.employeeId
        }
      }
    })

    // Log document access
    await prisma.documentAccessLog.create({
      data: {
        documentId: document.id,
        userId: session.user.id,
        userName: currentUser.name || currentUser.email,
        action: 'UPLOAD',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
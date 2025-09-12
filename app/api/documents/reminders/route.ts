import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reminderSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  reminderType: z.enum(['EXPIRY_WARNING', 'RENEWAL_DUE', 'APPROVAL_PENDING', 'COMPLIANCE_CHECK']),
  reminderDate: z.string().datetime(),
  message: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const documentId = searchParams.get('documentId')
    const type = searchParams.get('type')
    const pending = searchParams.get('pending') === 'true'

    // Build where clause
    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (documentId) where.documentId = documentId
    if (type) where.reminderType = type
    if (pending) where.isSent = false

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If not admin/HR, only show own reminders
    if (!['ADMIN', 'HR'].includes(currentUser.role)) {
      where.employeeId = currentUser.employee?.id
    }

    const reminders = await prisma.documentReminder.findMany({
      where,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            category: true,
            expiryDate: true
          }
        }
      },
      orderBy: { reminderDate: 'asc' }
    })

    return NextResponse.json({ reminders })
  } catch (error) {
    console.error('Error fetching document reminders:', error)
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

    const body = await request.json()
    const validatedData = reminderSchema.parse(body)

    // Check if user has permission to create reminders
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const canCreateReminder = 
      ['ADMIN', 'HR'].includes(currentUser.role) ||
      (currentUser.employee?.id === validatedData.employeeId)

    if (!canCreateReminder) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: validatedData.documentId }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Create reminder
    const reminder = await prisma.documentReminder.create({
      data: {
        documentId: validatedData.documentId,
        employeeId: validatedData.employeeId,
        reminderType: validatedData.reminderType,
        reminderDate: new Date(validatedData.reminderDate),
        message: validatedData.message
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        resource: 'DOCUMENT_REMINDER',
        resourceId: reminder.id,
        newValues: {
          documentId: validatedData.documentId,
          employeeId: validatedData.employeeId,
          reminderType: validatedData.reminderType,
          reminderDate: validatedData.reminderDate
        }
      }
    })

    return NextResponse.json({ reminder }, { status: 201 })
  } catch (error) {
    console.error('Error creating document reminder:', error)
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

// Auto-generate reminders for documents with expiry dates
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin/HR can trigger auto-generation
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find documents with expiry dates that need reminders
    const documentsWithExpiry = await prisma.document.findMany({
      where: {
        expiryDate: {
          not: null,
          gte: new Date() // Only future expiry dates
        },
        status: 'ACTIVE'
      },
      include: {
        reminders: {
          where: {
            reminderType: 'EXPIRY_WARNING',
            isActive: true
          }
        }
      }
    })

    const remindersCreated = []

    for (const document of documentsWithExpiry) {
      if (!document.expiryDate || !document.employeeId) continue

      // Check if reminder already exists
      const hasExpiryReminder = document.reminders.some(
        r => r.reminderType === 'EXPIRY_WARNING' && r.isActive
      )

      if (!hasExpiryReminder) {
        // Create reminder 30 days before expiry
        const reminderDate = new Date(document.expiryDate)
        reminderDate.setDate(reminderDate.getDate() - 30)

        // Only create if reminder date is in the future
        if (reminderDate > new Date()) {
          const reminder = await prisma.documentReminder.create({
            data: {
              documentId: document.id,
              employeeId: document.employeeId,
              reminderType: 'EXPIRY_WARNING',
              reminderDate,
              message: `Document "${document.title}" will expire on ${document.expiryDate.toDateString()}. Please renew or update as needed.`
            }
          })
          remindersCreated.push(reminder)
        }
      }
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'BULK_CREATE',
        resource: 'DOCUMENT_REMINDER',
        newValues: {
          remindersCreated: remindersCreated.length,
          documentsProcessed: documentsWithExpiry.length
        }
      }
    })

    return NextResponse.json({
      success: true,
      remindersCreated: remindersCreated.length,
      documentsProcessed: documentsWithExpiry.length
    })
  } catch (error) {
    console.error('Error auto-generating document reminders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
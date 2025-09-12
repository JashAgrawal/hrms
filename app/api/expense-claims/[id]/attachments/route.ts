import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

// GET /api/expense-claims/[id]/attachments - Get attachments for expense claim
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const attachments = await prisma.expenseAttachment.findMany({
      where: { expenseId: resolvedParams.id },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    console.error('Error fetching expense attachments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attachments' },
      { status: 500 }
    )
  }
}

// POST /api/expense-claims/[id]/attachments - Upload attachment for expense claim
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const resolvedParams = await params
    // Check if expense claim exists and user can upload attachments
    const expenseClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        employeeId: true,
        status: true,
      },
    })

    if (!expenseClaim) {
      return NextResponse.json(
        { error: 'Expense claim not found' },
        { status: 404 }
      )
    }

    // Only allow uploads if user owns the claim and it's still pending
    if (expenseClaim.employeeId !== user.employee.id || expenseClaim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot upload attachments to this expense claim' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed' },
        { status: 400 }
      )
    }

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExtension}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'expenses')
    const filePath = join(uploadDir, fileName)

    // Ensure upload directory exists
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Create attachment record
    const attachment = await prisma.expenseAttachment.create({
      data: {
        expenseId: resolvedParams.id,
        fileName,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileUrl: `/uploads/expenses/${fileName}`,
        thumbnailUrl: file.type.startsWith('image/') ? `/uploads/expenses/${fileName}` : null,
      },
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error('Error uploading expense attachment:', error)
    return NextResponse.json(
      { error: 'Failed to upload attachment' },
      { status: 500 }
    )
  }
}

// DELETE /api/expense-claims/[id]/attachments - Delete all attachments for expense claim
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { employee: true },
    })

    if (!user?.employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const resolvedParams = await params
    // Check if expense claim exists and user can delete attachments
    const expenseClaim = await prisma.expenseClaim.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        employeeId: true,
        status: true,
      },
    })

    if (!expenseClaim) {
      return NextResponse.json(
        { error: 'Expense claim not found' },
        { status: 404 }
      )
    }

    // Only allow deletion if user owns the claim and it's still pending
    if (expenseClaim.employeeId !== user.employee.id || expenseClaim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot delete attachments from this expense claim' },
        { status: 403 }
      )
    }

    await prisma.expenseAttachment.deleteMany({
      where: { expenseId: resolvedParams.id },
    })

    return NextResponse.json({ message: 'All attachments deleted successfully' })
  } catch (error) {
    console.error('Error deleting expense attachments:', error)
    return NextResponse.json(
      { error: 'Failed to delete attachments' },
      { status: 500 }
    )
  }
}
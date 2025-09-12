import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { unlink } from 'fs/promises'
import { join } from 'path'

// DELETE /api/expense-claims/[id]/attachments/[attachmentId] - Delete specific attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
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

    // Get attachment details
    const attachment = await prisma.expenseAttachment.findUnique({
      where: {
        id: resolvedParams.attachmentId,
        expenseId: resolvedParams.id,
      },
    })

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      )
    }

    // Delete file from filesystem
    try {
      const filePath = join(process.cwd(), 'public', attachment.fileUrl)
      await unlink(filePath)
    } catch (error) {
      console.warn('Failed to delete file from filesystem:', error)
      // Continue with database deletion even if file deletion fails
    }

    // Delete attachment record
    await prisma.expenseAttachment.delete({
      where: { id: resolvedParams.attachmentId },
    })

    return NextResponse.json({ message: 'Attachment deleted successfully' })
  } catch (error) {
    console.error('Error deleting expense attachment:', error)
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    )
  }
}
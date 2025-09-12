import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const securitySettingsSchema = z.object({
  encryptionEnabled: z.boolean(),
  watermarkEnabled: z.boolean(),
  accessLoggingEnabled: z.boolean(),
  downloadRestrictions: z.boolean(),
  ipWhitelist: z.array(z.string()),
  maxFileSize: z.number().min(1024), // Minimum 1KB
  allowedFileTypes: z.array(z.string()),
  passwordProtection: z.boolean(),
  expiryEnforcement: z.boolean()
})

// Mock security settings storage (in a real app, this would be in the database)
let securitySettings = {
  encryptionEnabled: true,
  watermarkEnabled: false,
  accessLoggingEnabled: true,
  downloadRestrictions: false,
  ipWhitelist: [] as string[],
  maxFileSize: 10485760, // 10MB
  allowedFileTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'],
  passwordProtection: false,
  expiryEnforcement: true
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin/HR can view security settings
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ settings: securitySettings })
  } catch (error) {
    console.error('Error fetching security settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can update security settings
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = securitySettingsSchema.parse(body)

    // Store old settings for audit log
    const oldSettings = { ...securitySettings }

    // Update settings
    securitySettings = { ...validatedData }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        resource: 'DOCUMENT_SECURITY_SETTINGS',
        oldValues: oldSettings,
        newValues: securitySettings
      }
    })

    return NextResponse.json({ settings: securitySettings })
  } catch (error) {
    console.error('Error updating security settings:', error)
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
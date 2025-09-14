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

// Helper function to get or create default security settings
async function getSecuritySettings() {
  let settings = await prisma.securitySettings.findFirst()

  if (!settings) {
    // Create default settings if none exist
    settings = await prisma.securitySettings.create({
      data: {
        encryptionEnabled: true,
        watermarkEnabled: false,
        accessLoggingEnabled: true,
        downloadRestrictions: false,
        ipWhitelist: [],
        maxFileSize: 10485760, // 10MB
        allowedFileTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'],
        passwordProtection: false,
        expiryEnforcement: true
      }
    })
  }

  return {
    ...settings,
    ipWhitelist: Array.isArray(settings.ipWhitelist) ? settings.ipWhitelist : [],
    allowedFileTypes: Array.isArray(settings.allowedFileTypes) ? settings.allowedFileTypes : []
  }
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

    const settings = await getSecuritySettings()
    return NextResponse.json({ settings })
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

    // Get current settings for audit log
    const oldSettings = await getSecuritySettings()

    // Update or create settings
    const updatedSettings = await prisma.securitySettings.upsert({
      where: { id: oldSettings.id || 'default' },
      update: {
        encryptionEnabled: validatedData.encryptionEnabled,
        watermarkEnabled: validatedData.watermarkEnabled,
        accessLoggingEnabled: validatedData.accessLoggingEnabled,
        downloadRestrictions: validatedData.downloadRestrictions,
        ipWhitelist: validatedData.ipWhitelist,
        maxFileSize: validatedData.maxFileSize,
        allowedFileTypes: validatedData.allowedFileTypes,
        passwordProtection: validatedData.passwordProtection,
        expiryEnforcement: validatedData.expiryEnforcement
      },
      create: {
        encryptionEnabled: validatedData.encryptionEnabled,
        watermarkEnabled: validatedData.watermarkEnabled,
        accessLoggingEnabled: validatedData.accessLoggingEnabled,
        downloadRestrictions: validatedData.downloadRestrictions,
        ipWhitelist: validatedData.ipWhitelist,
        maxFileSize: validatedData.maxFileSize,
        allowedFileTypes: validatedData.allowedFileTypes,
        passwordProtection: validatedData.passwordProtection,
        expiryEnforcement: validatedData.expiryEnforcement
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        resource: 'DOCUMENT_SECURITY_SETTINGS',
        oldValues: oldSettings,
        newValues: updatedSettings
      }
    })

    const settings = {
      ...updatedSettings,
      ipWhitelist: Array.isArray(updatedSettings.ipWhitelist) ? updatedSettings.ipWhitelist : [],
      allowedFileTypes: Array.isArray(updatedSettings.allowedFileTypes) ? updatedSettings.allowedFileTypes : []
    }

    return NextResponse.json({ settings })
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
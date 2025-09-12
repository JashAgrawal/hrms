import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/auth'
import { z } from 'zod'

const TemplateEntrySchema = z.object({
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  breakDuration: z.number().min(0).max(480),
  projectId: z.string().optional(),
  taskDescription: z.string().optional(),
  billableHours: z.number().min(0).max(24),
  nonBillableHours: z.number().min(0).max(24),
  overtimeHours: z.number().min(0).max(24),
  dayOfWeek: z.number().min(0).max(6)
})

const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  entries: z.array(TemplateEntrySchema)
})

export async function GET(request: NextRequest) {
  try {
    // TODO: TimesheetTemplate model not implemented yet
    return NextResponse.json({ error: 'Timesheet templates not implemented' }, { status: 501 })
  } catch (error) {
    console.error('Templates GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // TODO: TimesheetTemplate model not implemented yet
    return NextResponse.json({ error: 'Timesheet templates not implemented' }, { status: 501 })
  } catch (error) {
    console.error('Templates POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
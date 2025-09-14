import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createHolidaySchema = z.object({
  name: z.string().min(1, 'Holiday name is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  type: z.enum(['PUBLIC', 'COMPANY', 'OPTIONAL', 'RELIGIOUS', 'NATIONAL']).default('PUBLIC'),
  description: z.string().optional(),
  isOptional: z.boolean().default(false)
})

// GET /api/holidays - Get holidays
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const upcoming = searchParams.get('upcoming') === 'true'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    const whereConditions: any = {
      isActive: true,
      year
    }

    if (upcoming) {
      whereConditions.date = {
        gte: new Date()
      }
    }

    const holidays = await prisma.holiday.findMany({
      where: whereConditions,
      orderBy: {
        date: 'asc'
      },
      take: limit
    })

    return NextResponse.json({ holidays })
  } catch (error) {
    console.error('Error fetching holidays:', error)
    return NextResponse.json(
      { error: 'Failed to fetch holidays' },
      { status: 500 }
    )
  }
}

// POST /api/holidays - Create holiday (Admin/HR only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create holidays
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validation = createHolidaySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid holiday data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { name, date, type, description, isOptional } = validation.data
    const holidayDate = new Date(date)
    const year = holidayDate.getFullYear()

    // Check if holiday already exists for this date
    const existingHoliday = await prisma.holiday.findFirst({
      where: {
        date: holidayDate,
        isActive: true
      }
    })

    if (existingHoliday) {
      return NextResponse.json(
        { error: 'Holiday already exists for this date' },
        { status: 409 }
      )
    }

    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: holidayDate,
        type,
        description,
        isOptional,
        year
      }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        resource: 'HOLIDAY',
        newValues: holiday
      }
    })

    return NextResponse.json({ holiday }, { status: 201 })
  } catch (error) {
    console.error('Error creating holiday:', error)
    return NextResponse.json(
      { error: 'Failed to create holiday' },
      { status: 500 }
    )
  }
}
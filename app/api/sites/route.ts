import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  code: z.string().min(1, 'Site code is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().default('India'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(10).max(1000).default(50),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  description: z.string().optional(),
  siteType: z.enum(['CLIENT', 'VENDOR', 'PARTNER', 'WAREHOUSE', 'OFFICE', 'OTHER']).default('CLIENT'),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const siteType = searchParams.get('siteType')
    const city = searchParams.get('city')
    const isActive = searchParams.get('isActive')

    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (siteType) {
      where.siteType = siteType
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' }
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const [sites, total] = await Promise.all([
      prisma.site.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              siteVisits: true,
              employeeSites: true,
            },
          },
        },
      }),
      prisma.site.count({ where }),
    ])

    return NextResponse.json({
      sites,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching sites:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sites' },
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

    // Check if user has permission to create sites (Admin/HR)
    if (!['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createSiteSchema.parse(body)

    // Check if site code already exists
    const existingSite = await prisma.site.findFirst({
      where: {
        OR: [
          { code: validatedData.code },
          { name: validatedData.name },
        ],
      },
    })

    if (existingSite) {
      return NextResponse.json(
        { error: 'Site with this code or name already exists' },
        { status: 400 }
      )
    }

    const site = await prisma.site.create({
      data: {
        ...validatedData,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
      },
    })

    return NextResponse.json(site, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating site:', error)
    return NextResponse.json(
      { error: 'Failed to create site' },
      { status: 500 }
    )
  }
}
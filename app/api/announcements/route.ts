import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(["GENERAL", "POLICY", "EVENT", "HOLIDAY", "SYSTEM", "URGENT", "CELEBRATION"]).default("GENERAL"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
  expiresAt: z.string().datetime().optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    size: z.number(),
    type: z.string()
  })).optional(),
  targetAudience: z.object({
    departments: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
    employees: z.array(z.string()).optional()
  }).optional(),
  isGlobal: z.boolean().default(false),
  publishNow: z.boolean().default(false)
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const type = searchParams.get("type")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const where: any = {}
    
    if (status) {
      where.status = status
    }
    
    if (type) {
      where.type = type
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: [
          { priority: "desc" },
          { publishedAt: "desc" },
          { createdAt: "desc" }
        ],
        skip,
        take: limit,
        include: {
          views: {
            select: {
              employeeId: true,
              viewedAt: true
            }
          }
        }
      }),
      prisma.announcement.count({ where })
    ])

    return NextResponse.json({
      announcements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching announcements:", error)
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to create announcements (HR/Admin)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !["ADMIN", "HR"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createAnnouncementSchema.parse(body)

    const announcement = await prisma.announcement.create({
      data: {
        title: validatedData.title,
        content: validatedData.content,
        type: validatedData.type,
        priority: validatedData.priority,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        attachments: validatedData.attachments || [],
        targetAudience: validatedData.targetAudience || {},
        isGlobal: validatedData.isGlobal,
        status: validatedData.publishNow ? "PUBLISHED" : "DRAFT",
        publishedAt: validatedData.publishNow ? new Date() : null,
        publishedBy: validatedData.publishNow ? session.user.id : null,
        createdBy: session.user.id
      }
    })

    return NextResponse.json(announcement, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating announcement:", error)
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 }
    )
  }
}
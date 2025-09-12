import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  content: z.string().min(1, "Content is required").optional(),
  type: z.enum(["GENERAL", "POLICY", "EVENT", "HOLIDAY", "SYSTEM", "URGENT", "CELEBRATION"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
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
  isGlobal: z.boolean().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        views: {
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    return NextResponse.json(announcement)
  } catch (error) {
    console.error("Error fetching announcement:", error)
    return NextResponse.json(
      { error: "Failed to fetch announcement" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to update announcements (HR/Admin)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !["ADMIN", "HR"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateAnnouncementSchema.parse(body)

    const existingAnnouncement = await prisma.announcement.findUnique({
      where: { id }
    })

    if (!existingAnnouncement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    const updateData: any = { ...validatedData }

    // Handle publishing logic
    if (validatedData.status === "PUBLISHED" && existingAnnouncement.status === "DRAFT") {
      updateData.publishedAt = new Date()
      updateData.publishedBy = session.user.id
    }

    if (validatedData.expiresAt) {
      updateData.expiresAt = new Date(validatedData.expiresAt)
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(announcement)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating announcement:", error)
    return NextResponse.json(
      { error: "Failed to update announcement" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to delete announcements (HR/Admin)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !["ADMIN", "HR"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params

    await prisma.announcement.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Announcement deleted successfully" })
  } catch (error) {
    console.error("Error deleting announcement:", error)
    return NextResponse.json(
      { error: "Failed to delete announcement" },
      { status: 500 }
    )
  }
}
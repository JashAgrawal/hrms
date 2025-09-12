import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id }
    })

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    // Check if announcement exists
    const announcement = await prisma.announcement.findUnique({
      where: { id }
    })

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    // Create or update view record
    await prisma.announcementView.upsert({
      where: {
        announcementId_employeeId: {
          announcementId: id,
          employeeId: employee.id
        }
      },
      update: {
        viewedAt: new Date()
      },
      create: {
        announcementId: id,
        employeeId: employee.id
      }
    })

    // Increment view count
    await prisma.announcement.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1
        }
      }
    })

    return NextResponse.json({ message: "View recorded successfully" })
  } catch (error) {
    console.error("Error recording announcement view:", error)
    return NextResponse.json(
      { error: "Failed to record view" },
      { status: 500 }
    )
  }
}
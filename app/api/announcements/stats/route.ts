import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to view stats (HR/Admin)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !["ADMIN", "HR"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const [total, published, drafts, totalViewsResult] = await Promise.all([
      prisma.announcement.count(),
      prisma.announcement.count({ where: { status: "PUBLISHED" } }),
      prisma.announcement.count({ where: { status: "DRAFT" } }),
      prisma.announcement.aggregate({
        _sum: {
          viewCount: true
        }
      })
    ])

    return NextResponse.json({
      total,
      published,
      drafts,
      totalViews: totalViewsResult._sum.viewCount || 0
    })
  } catch (error) {
    console.error("Error fetching announcement stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
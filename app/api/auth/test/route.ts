import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    return NextResponse.json({
      message: "Authentication successful",
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        isActive: session.user.isActive,
        provider: session.user.provider
      }
    })
  } catch (error) {
    console.error("Auth test error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
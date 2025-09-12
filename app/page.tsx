"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Logo } from "@/components/shared/logo"

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return // Still loading

    if (session) {
      router.push("/dashboard")
    } else {
      router.push("/auth/signin")
    }
  }, [session, status, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <Logo size="xl" />
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
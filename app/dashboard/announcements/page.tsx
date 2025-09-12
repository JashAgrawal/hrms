import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AnnouncementDashboard } from "@/components/announcements/announcement-dashboard"

export default async function AnnouncementsPage() {
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  const userRole = (session.user as { role?: string })?.role || "EMPLOYEE"

  return <AnnouncementDashboard userRole={userRole} />
}
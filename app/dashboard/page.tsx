import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RoleBasedDashboard } from "@/components/dashboard/role-based-dashboard"

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  // Get user role from session - in real app, this would come from database
  const userRole = (session.user as { role?: string })?.role || "EMPLOYEE"

  return <RoleBasedDashboard userRole={userRole} />
}
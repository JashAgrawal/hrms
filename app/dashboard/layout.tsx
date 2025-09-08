import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  // Mock user data - in real app, this would come from the session/database
  const user = {
    name: session.user?.name || "John Doe",
    email: session.user?.email || "john@company.com",
    avatar: session.user?.image || undefined,
    role: (session.user as { role?: string })?.role || "EMPLOYEE",
  }

  return (
    <DashboardLayout user={user}>
      {children}
    </DashboardLayout>
  )
}
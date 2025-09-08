import { AdminDashboard } from "./admin-dashboard"
import { HRDashboard } from "./hr-dashboard"
import { ManagerDashboard } from "./manager-dashboard"
import { EmployeeDashboard } from "./employee-dashboard"

interface RoleBasedDashboardProps {
  userRole: string
}

export function RoleBasedDashboard({ userRole }: RoleBasedDashboardProps) {
  switch (userRole.toUpperCase()) {
    case "ADMIN":
      return <AdminDashboard />
    case "HR":
      return <HRDashboard />
    case "MANAGER":
      return <ManagerDashboard />
    case "FINANCE":
      return <AdminDashboard /> // Finance users see admin dashboard
    case "EMPLOYEE":
    default:
      return <EmployeeDashboard />
  }
}
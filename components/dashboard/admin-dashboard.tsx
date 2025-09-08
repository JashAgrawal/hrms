'use client'

import { useEffect, useState } from "react";
import {
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  UserPlus,
  Settings,
  FileText,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { StatsCard } from "./widgets/stats-card";
import { QuickActions } from "./widgets/quick-actions";
import { RecentActivity } from "./widgets/recent-activity";

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingOnboarding: number;
  monthlyPayroll: number;
  attendanceRate: number;
  leaveRequests: number;
  attendanceRequests: number;
  expenseClaims: number;
}

interface Activity {
  id: string;
  user: { name: string; avatar: string };
  action: string;
  target: string;
  timestamp: Date;
  status: "success" | "info" | "warning" | "error";
}

  const quickActions = [
    {
      title: "Add New Employee",
      description: "Create employee profile and start onboarding",
      href: "/dashboard/employees/new",
      icon: UserPlus,
      variant: "default" as const,
    },
    {
      title: "Manage Locations",
      description: "Configure work locations and geo-fencing",
      href: "/dashboard/locations",
      icon: Settings,
      variant: "secondary" as const,
    },
    {
      title: "View Audit Logs",
      description: "Monitor system activity and security",
      href: "/dashboard/audit-logs",
      icon: Shield,
    },
    {
      title: "Generate Reports",
      description: "Create compliance and analytics reports",
      href: "/dashboard/reports",
      icon: FileText,
    },
  ];

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard stats
      const [statsResponse, activitiesResponse] = await Promise.all([
        fetch('/api/admin/dashboard/stats'),
        fetch('/api/audit-logs?limit=10')
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        // Transform audit logs to activities format
        const transformedActivities = activitiesData.logs?.slice(0, 6).map((log: any) => ({
          id: log.id,
          user: { 
            name: log.user?.employeeName || log.user?.name || 'System',
            avatar: "" 
          },
          action: formatAction(log.action),
          target: formatTarget(log.resource, log.newValues),
          timestamp: new Date(log.timestamp),
          status: getStatusFromAction(log.action),
        })) || [];
        setActivities(transformedActivities);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Use fallback data
      setStats({
        totalEmployees: 0,
        activeEmployees: 0,
        pendingOnboarding: 0,
        monthlyPayroll: 0,
        attendanceRate: 0,
        leaveRequests: 0,
        attendanceRequests: 0,
        expenseClaims: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAction = (action: string): string => {
    const actionMap: Record<string, string> = {
      'APPROVE_LEAVE': 'approved leave request for',
      'REJECT_LEAVE': 'rejected leave request for',
      'CREATE': 'created',
      'UPDATE': 'updated',
      'DELETE': 'deleted',
      'VIEW': 'viewed',
      'LOGIN': 'logged in',
      'LOGOUT': 'logged out',
      'CHECK_IN': 'checked in',
      'CHECK_OUT': 'checked out',
      'APPROVE_ATTENDANCE_REQUEST': 'approved attendance request for',
      'REJECT_ATTENDANCE_REQUEST': 'rejected attendance request for',
    };
    return actionMap[action] || action.toLowerCase().replace('_', ' ');
  };

  const formatTarget = (resource: string, newValues: any): string => {
    if (newValues?.employeeName) {
      return newValues.employeeName;
    }
    if (newValues?.name) {
      return newValues.name;
    }
    return resource.toLowerCase().replace('_', ' ');
  };

  const getStatusFromAction = (action: string): Activity['status'] => {
    if (action.includes('APPROVE')) return 'success';
    if (action.includes('REJECT')) return 'error';
    if (action.includes('CREATE')) return 'success';
    if (action.includes('DELETE')) return 'warning';
    return 'info';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Loading system overview...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System overview and administrative controls
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Employees"
          value={stats?.totalEmployees.toLocaleString() || '0'}
          description={`${stats?.activeEmployees || 0} active`}
          icon={Users}
          trend={{
            value: 5.2,
            label: "from last month",
            isPositive: true,
          }}
        />
        <StatsCard
          title="Attendance Rate"
          value={`${stats?.attendanceRate.toFixed(1) || '0.0'}%`}
          description="This month average"
          icon={Clock}
          trend={{
            value: 2.1,
            label: "from last month",
            isPositive: true,
          }}
        />
        <StatsCard
          title="Monthly Payroll"
          value={`₹${((stats?.monthlyPayroll || 0) / 100000).toFixed(1)}L`}
          description="Current month total"
          icon={DollarSign}
          trend={{
            value: 3.8,
            label: "from last month",
            isPositive: true,
          }}
        />
        <StatsCard
          title="Pending Actions"
          value={(stats?.leaveRequests || 0) + (stats?.attendanceRequests || 0)}
          description={`${stats?.leaveRequests || 0} leave, ${stats?.attendanceRequests || 0} attendance requests`}
          icon={AlertTriangle}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <QuickActions title="Quick Actions" actions={quickActions} />
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <RecentActivity
            title="Recent System Activity"
            activities={activities}
            maxItems={6}
          />
        </div>
      </div>

      {/* Additional Admin Widgets */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Health */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">System Health</h3>
          <div className="grid gap-4">
            <StatsCard
              title="Database Performance"
              value="98.5%"
              description="Average response time: 45ms"
              icon={TrendingUp}
            />
            <StatsCard
              title="Active Sessions"
              value="342"
              description="Peak today: 456"
              icon={Users}
            />
          </div>
        </div>

        {/* Compliance Status */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Compliance Status</h3>
          <div className="grid gap-4">
            <StatsCard
              title="PF Compliance"
              value="100%"
              description="All employees covered"
              icon={FileText}
            />
            <StatsCard
              title="Tax Filings"
              value="Up to date"
              description="Next filing: 15th Jan"
              icon={FileText}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

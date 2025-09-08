"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  UserCheck,
  Search,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
} from "lucide-react";

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  dueDate?: string;
}

interface OnboardingEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  department: {
    name: string;
  };
  startDate: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  tasks: OnboardingTask[];
  completedTasks: number;
  totalTasks: number;
  progress: number;
}

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const [employees, setEmployees] = useState<OnboardingEmployee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<
    OnboardingEmployee[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (!["ADMIN", "HR"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  useEffect(() => {
    fetchOnboardingData();
  }, []);

  useEffect(() => {
    let filtered = employees;

    if (searchTerm) {
      filtered = filtered.filter(
        (emp) =>
          `${emp.firstName} ${emp.lastName}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((emp) => emp.status === statusFilter);
    }

    setFilteredEmployees(filtered);
  }, [employees, searchTerm, statusFilter]);

  const fetchOnboardingData = async () => {
    try {
      setIsLoading(true);
      // Mock data for now - replace with actual API call
      const mockData: OnboardingEmployee[] = [
        {
          id: "1",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@company.com",
          employeeCode: "EMP001",
          department: { name: "Engineering" },
          startDate: "2024-01-15",
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "1",
              title: "Complete profile setup",
              description: "Fill in personal details",
              status: "COMPLETED",
              dueDate: "2024-01-16",
            },
            {
              id: "2",
              title: "IT equipment setup",
              description: "Receive laptop and access cards",
              status: "COMPLETED",
              dueDate: "2024-01-17",
            },
            {
              id: "3",
              title: "HR orientation",
              description: "Attend HR orientation session",
              status: "IN_PROGRESS",
              dueDate: "2024-01-18",
            },
            {
              id: "4",
              title: "Team introduction",
              description: "Meet with team members",
              status: "PENDING",
              dueDate: "2024-01-19",
            },
          ],
          completedTasks: 2,
          totalTasks: 4,
          progress: 50,
        },
        {
          id: "2",
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@company.com",
          employeeCode: "EMP002",
          department: { name: "Marketing" },
          startDate: "2024-01-20",
          status: "PENDING",
          tasks: [
            {
              id: "5",
              title: "Complete profile setup",
              description: "Fill in personal details",
              status: "PENDING",
              dueDate: "2024-01-21",
            },
            {
              id: "6",
              title: "IT equipment setup",
              description: "Receive laptop and access cards",
              status: "PENDING",
              dueDate: "2024-01-22",
            },
            {
              id: "7",
              title: "HR orientation",
              description: "Attend HR orientation session",
              status: "PENDING",
              dueDate: "2024-01-23",
            },
          ],
          completedTasks: 0,
          totalTasks: 3,
          progress: 0,
        },
      ];
      setEmployees(mockData);
    } catch (error) {
      console.error("Error fetching onboarding data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4" />;
      case "IN_PROGRESS":
        return <Clock className="h-4 w-4" />;
      case "PENDING":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading onboarding data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employee Onboarding</h1>
          <p className="text-gray-600">
            Track and manage new employee onboarding progress
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Onboarding
                </p>
                <p className="text-2xl font-bold">{employees.length}</p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {
                    employees.filter((emp) => emp.status === "IN_PROGRESS")
                      .length
                  }
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {employees.filter((emp) => emp.status === "COMPLETED").length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {employees.filter((emp) => emp.status === "PENDING").length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex space-x-2">
          {["all", "PENDING", "IN_PROGRESS", "COMPLETED"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === "all" ? "All" : status.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      {/* Employee Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredEmployees.map((employee) => (
          <Card key={employee.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {employee.firstName} {employee.lastName}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {employee.employeeCode}
                    </p>
                    <p className="text-sm text-gray-600">
                      {employee.department.name}
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(employee.status)}>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(employee.status)}
                    <span>{employee.status.replace("_", " ")}</span>
                  </div>
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm text-gray-600">
                      {employee.completedTasks}/{employee.totalTasks} tasks
                    </span>
                  </div>
                  <Progress value={employee.progress} className="h-2" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Recent Tasks</h4>
                  {employee.tasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(task.status)}
                        <span className="text-sm">{task.title}</span>
                      </div>
                      {task.dueDate && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Started:{" "}
                      {new Date(employee.startDate).toLocaleDateString()}
                    </span>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredEmployees.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No onboarding employees found
          </h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== "all"
              ? "No employees match your current filters."
              : "No employees are currently in the onboarding process."}
          </p>
        </div>
      )}
    </div>
  );
}

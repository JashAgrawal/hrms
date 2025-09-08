import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OnboardingWorkflow } from "@/components/employees/onboarding-workflow";
import { DocumentUpload } from "@/components/employees/document-upload";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

async function getWorkflow(id: string, currentUser: any) {
  const whereClause: any = { id };

  // Apply role-based filtering
  if (currentUser.role === "EMPLOYEE" && currentUser.employee) {
    whereClause.employeeId = currentUser.employee.id;
  } else if (currentUser.role === "MANAGER" && currentUser.employee) {
    const subordinates = await prisma.employee.findMany({
      where: { reportingTo: currentUser.employee.id },
      select: { id: true },
    });
    whereClause.employeeId = {
      in: [currentUser.employee.id, ...subordinates.map((s) => s.id)],
    };
  }

  return await prisma.onboardingWorkflow.findFirst({
    where: whereClause,
    include: {
      employee: {
        include: {
          department: {
            select: { name: true },
          },
        },
      },
      template: {
        select: {
          name: true,
          description: true,
        },
      },
      tasks: {
        include: {
          task: true,
        },
        orderBy: {
          task: {
            order: "asc",
          },
        },
      },
      approvals: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

async function getEmployeeDocuments(employeeId: string) {
  return await prisma.document.findMany({
    where: {
      employeeId,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function OnboardingWorkflowPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { employee: true },
  });

  if (!currentUser) {
    redirect("/auth/signin");
  }

  const workflow = await getWorkflow(params.id, currentUser);

  if (!workflow) {
    notFound();
  }

  const documents = await getEmployeeDocuments(workflow.employeeId);

  // Transform workflow data for the component
  const workflowData = {
    id: workflow.id,
    employeeId: workflow.employeeId,
    status: workflow.status,
    startDate: workflow.startDate,
    dueDate: workflow.dueDate || undefined,
    completedAt: workflow.completedAt || undefined,
    assignedTo: workflow.assignedTo || undefined,
    notes: workflow.notes || undefined,
    employee: {
      firstName: workflow.employee.firstName,
      lastName: workflow.employee.lastName,
      employeeCode: workflow.employee.employeeCode,
      designation: workflow.employee.designation,
      joiningDate: workflow.employee.joiningDate,
      department: {
        name: workflow.employee.department.name,
      },
    },
    tasks: workflow.tasks.map((wt) => ({
      id: wt.id,
      title: wt.task.title,
      description: wt.task.description || undefined,
      category: wt.task.category,
      isRequired: wt.task.isRequired,
      order: wt.task.order,
      daysToComplete: wt.task.daysToComplete || undefined,
      assignedRole: wt.task.assignedRole,
      status: wt.status,
      assignedTo: wt.assignedTo || undefined,
      startedAt: wt.startedAt || undefined,
      completedAt: wt.completedAt || undefined,
      dueDate: wt.dueDate || undefined,
      notes: wt.notes || undefined,
      documents: wt.documents ? JSON.parse(wt.documents as string) : [],
    })),
  };

  // Transform documents for the upload component
  const documentData = documents.map((doc) => ({
    id: doc.id,
    name: doc.fileName,
    size: doc.fileSize || 0,
    type: doc.mimeType || "application/octet-stream",
    category: doc.category,
    status: "uploaded" as const,
    url: doc.fileUrl,
    uploadedAt: doc.createdAt,
  }));

  const documentCategories = [
    { value: "PERSONAL", label: "Personal Documents", required: true },
    { value: "PROFESSIONAL", label: "Professional Documents", required: true },
    { value: "COMPLIANCE", label: "Compliance Documents", required: true },
    { value: "PAYROLL", label: "Payroll Documents", required: false },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/employees/onboarding">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Onboarding
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Onboarding Workflow
          </h1>
          <p className="text-muted-foreground">
            {workflow.employee.firstName} {workflow.employee.lastName} (
            {workflow.employee.employeeCode})
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="workflow" className="space-y-6">
        <TabsList>
          <TabsTrigger value="workflow">Workflow Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="space-y-6">
          <OnboardingWorkflow
            workflow={workflowData}
            currentUserRole={currentUser.role}
            currentUserId={session.user.id}
            onUpdate={() => {
              // This would trigger a refresh in a real implementation
              // For now, we'll rely on the user refreshing the page
            }}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Employee Documents</CardTitle>
              <CardDescription>
                Upload and manage documents required for onboarding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUpload
                employeeId={workflow.employeeId}
                existingDocuments={documentData}
                categories={documentCategories}
                onDocumentsChange={() => {
                  // Handle document changes
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

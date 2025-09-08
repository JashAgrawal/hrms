/*
  Warnings:

  - You are about to alter the column `days` on the `leave_requests` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(4,2)`.
  - A unique constraint covering the columns `[code]` on the table `leave_policies` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `leave_policies` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."AccrualType" AS ENUM ('ANNUAL', 'MONTHLY', 'QUARTERLY', 'ON_JOINING');

-- CreateEnum
CREATE TYPE "public"."HalfDayType" AS ENUM ('FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'HR', 'MANAGER', 'FINANCE', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "public"."OnboardingCategory" AS ENUM ('PERSONAL_INFO', 'DOCUMENTS', 'SYSTEM_ACCESS', 'TRAINING', 'COMPLIANCE', 'EQUIPMENT', 'INTRODUCTION');

-- CreateEnum
CREATE TYPE "public"."OnboardingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "public"."LeaveRequestStatus" ADD VALUE 'PARTIALLY_APPROVED';

-- AlterTable
ALTER TABLE "public"."leave_policies" ADD COLUMN     "accrualRate" DECIMAL(4,2),
ADD COLUMN     "accrualType" "public"."AccrualType" NOT NULL DEFAULT 'ANNUAL',
ADD COLUMN     "approvalLevels" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "encashmentRate" DECIMAL(5,2),
ADD COLUMN     "gender" "public"."Gender",
ADD COLUMN     "isEncashable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxConsecutiveDays" INTEGER,
ADD COLUMN     "minAdvanceNotice" INTEGER,
ADD COLUMN     "probationPeriodDays" INTEGER,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."leave_requests" ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "emergencyContact" JSONB,
ADD COLUMN     "halfDayType" "public"."HalfDayType",
ADD COLUMN     "handoverNotes" TEXT,
ADD COLUMN     "isHalfDay" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "days" SET DATA TYPE DECIMAL(4,2);

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "role" "public"."UserRole" NOT NULL DEFAULT 'EMPLOYEE';

-- CreateTable
CREATE TABLE "public"."leave_balances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "allocated" DECIMAL(4,2) NOT NULL,
    "used" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "pending" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "carriedForward" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "encashed" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "expired" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "available" DECIMAL(4,2) NOT NULL,
    "lastAccrualDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leave_approvals" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."onboarding_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."onboarding_tasks" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."OnboardingCategory" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "daysToComplete" INTEGER,
    "assignedRole" "public"."UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."onboarding_workflows" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "public"."OnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."onboarding_workflow_tasks" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_workflow_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."onboarding_approvals" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "approverRole" "public"."UserRole" NOT NULL,
    "approvedBy" TEXT,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_balances_employeeId_year_idx" ON "public"."leave_balances"("employeeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employeeId_policyId_year_key" ON "public"."leave_balances"("employeeId", "policyId", "year");

-- CreateIndex
CREATE INDEX "leave_approvals_approverId_status_idx" ON "public"."leave_approvals"("approverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "leave_approvals_leaveRequestId_level_key" ON "public"."leave_approvals"("leaveRequestId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_templates_name_key" ON "public"."onboarding_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_workflows_employeeId_key" ON "public"."onboarding_workflows"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_workflow_tasks_workflowId_taskId_key" ON "public"."onboarding_workflow_tasks"("workflowId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_policies_code_key" ON "public"."leave_policies"("code");

-- CreateIndex
CREATE INDEX "leave_requests_employeeId_status_idx" ON "public"."leave_requests"("employeeId", "status");

-- CreateIndex
CREATE INDEX "leave_requests_startDate_endDate_idx" ON "public"."leave_requests"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "public"."leave_balances" ADD CONSTRAINT "leave_balances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leave_balances" ADD CONSTRAINT "leave_balances_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."leave_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leave_approvals" ADD CONSTRAINT "leave_approvals_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "public"."leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."onboarding_workflows" ADD CONSTRAINT "onboarding_workflows_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."onboarding_workflows" ADD CONSTRAINT "onboarding_workflows_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."onboarding_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."onboarding_workflow_tasks" ADD CONSTRAINT "onboarding_workflow_tasks_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."onboarding_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."onboarding_workflow_tasks" ADD CONSTRAINT "onboarding_workflow_tasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."onboarding_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."onboarding_approvals" ADD CONSTRAINT "onboarding_approvals_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."onboarding_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `allowances` on the `payroll_records` table. All the data in the column will be lost.
  - You are about to drop the column `taxDeducted` on the `payroll_records` table. All the data in the column will be lost.
  - You are about to alter the column `basicSalary` on the `payroll_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `grossSalary` on the `payroll_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `netSalary` on the `payroll_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `pfDeduction` on the `payroll_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `esiDeduction` on the `payroll_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `totalGross` on the `payroll_runs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(15,2)`.
  - You are about to alter the column `totalNet` on the `payroll_runs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(15,2)`.
  - Added the required column `absentDays` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `earnings` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `presentDays` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalDeductions` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalEarnings` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workingDays` to the `payroll_records` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PayrollRecordStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PayComponentType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "public"."PayComponentCategory" AS ENUM ('BASIC', 'ALLOWANCE', 'BONUS', 'OVERTIME', 'STATUTORY_DEDUCTION', 'OTHER_DEDUCTION', 'REIMBURSEMENT');

-- CreateEnum
CREATE TYPE "public"."CalculationType" AS ENUM ('FIXED', 'PERCENTAGE', 'FORMULA', 'ATTENDANCE_BASED');

-- CreateEnum
CREATE TYPE "public"."RevisionType" AS ENUM ('INCREMENT', 'PROMOTION', 'MARKET_CORRECTION', 'BONUS', 'DEMOTION', 'SALARY_CUT');

-- CreateEnum
CREATE TYPE "public"."RevisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED');

-- CreateEnum
CREATE TYPE "public"."PayslipStatus" AS ENUM ('GENERATED', 'ACCESSED', 'DOWNLOADED', 'SENT');

-- CreateEnum
CREATE TYPE "public"."AttendanceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- AlterEnum
ALTER TYPE "public"."PayrollStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "public"."leave_approvals" ADD COLUMN     "approverName" TEXT;

-- AlterTable
ALTER TABLE "public"."payroll_records" DROP COLUMN "allowances",
DROP COLUMN "taxDeducted",
ADD COLUMN     "absentDays" DECIMAL(4,2) NOT NULL,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "earnings" JSONB NOT NULL,
ADD COLUMN     "lopAmount" DECIMAL(10,2),
ADD COLUMN     "lopDays" DECIMAL(4,2),
ADD COLUMN     "overtimeAmount" DECIMAL(10,2),
ADD COLUMN     "overtimeHours" DECIMAL(6,2),
ADD COLUMN     "presentDays" DECIMAL(4,2) NOT NULL,
ADD COLUMN     "ptDeduction" DECIMAL(10,2),
ADD COLUMN     "status" "public"."PayrollRecordStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "tdsDeduction" DECIMAL(10,2),
ADD COLUMN     "totalDeductions" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "totalEarnings" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "workingDays" INTEGER NOT NULL,
ALTER COLUMN "basicSalary" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "grossSalary" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "netSalary" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "pfDeduction" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "esiDeduction" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "public"."payroll_runs" ADD COLUMN     "employeeCount" INTEGER,
ADD COLUMN     "totalDeductions" DECIMAL(15,2),
ALTER COLUMN "totalGross" SET DATA TYPE DECIMAL(15,2),
ALTER COLUMN "totalNet" SET DATA TYPE DECIMAL(15,2);

-- CreateTable
CREATE TABLE "public"."employee_locations" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attendance_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkInTime" TIMESTAMP(3) NOT NULL,
    "location" JSONB,
    "reason" TEXT NOT NULL,
    "status" "public"."AttendanceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."salary_grades" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "minSalary" DECIMAL(12,2) NOT NULL,
    "maxSalary" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pay_components" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."PayComponentType" NOT NULL,
    "category" "public"."PayComponentCategory" NOT NULL,
    "calculationType" "public"."CalculationType" NOT NULL,
    "isStatutory" BOOLEAN NOT NULL DEFAULT false,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "formula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."salary_structures" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "gradeId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."salary_structure_components" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "value" DECIMAL(12,2),
    "percentage" DECIMAL(5,2),
    "baseComponent" TEXT,
    "minValue" DECIMAL(12,2),
    "maxValue" DECIMAL(12,2),
    "isVariable" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structure_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_salary_structures" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "ctc" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "revisionReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_salary_components" (
    "id" TEXT NOT NULL,
    "employeeSalaryId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."salary_revisions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "revisionType" "public"."RevisionType" NOT NULL,
    "oldCTC" DECIMAL(12,2) NOT NULL,
    "newCTC" DECIMAL(12,2) NOT NULL,
    "incrementAmount" DECIMAL(12,2) NOT NULL,
    "incrementPercent" DECIMAL(5,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "public"."RevisionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payslips" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "status" "public"."PayslipStatus" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_locations_employeeId_idx" ON "public"."employee_locations"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_locations_employeeId_locationId_key" ON "public"."employee_locations"("employeeId", "locationId");

-- CreateIndex
CREATE INDEX "attendance_requests_employeeId_status_idx" ON "public"."attendance_requests"("employeeId", "status");

-- CreateIndex
CREATE INDEX "attendance_requests_date_idx" ON "public"."attendance_requests"("date");

-- CreateIndex
CREATE UNIQUE INDEX "salary_grades_name_key" ON "public"."salary_grades"("name");

-- CreateIndex
CREATE UNIQUE INDEX "salary_grades_code_key" ON "public"."salary_grades"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pay_components_name_key" ON "public"."pay_components"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pay_components_code_key" ON "public"."pay_components"("code");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_name_key" ON "public"."salary_structures"("name");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_code_key" ON "public"."salary_structures"("code");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structure_components_structureId_componentId_key" ON "public"."salary_structure_components"("structureId", "componentId");

-- CreateIndex
CREATE INDEX "employee_salary_structures_employeeId_effectiveFrom_idx" ON "public"."employee_salary_structures"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "employee_salary_components_employeeSalaryId_componentId_key" ON "public"."employee_salary_components"("employeeSalaryId", "componentId");

-- CreateIndex
CREATE INDEX "salary_revisions_employeeId_effectiveFrom_idx" ON "public"."salary_revisions"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "payslips_employeeId_idx" ON "public"."payslips"("employeeId");

-- CreateIndex
CREATE INDEX "payslips_payrollRunId_idx" ON "public"."payslips"("payrollRunId");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_employeeId_payrollRunId_key" ON "public"."payslips"("employeeId", "payrollRunId");

-- CreateIndex
CREATE INDEX "departments_headId_idx" ON "public"."departments"("headId");

-- CreateIndex
CREATE INDEX "payroll_records_payrollRunId_status_idx" ON "public"."payroll_records"("payrollRunId", "status");

-- AddForeignKey
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_headId_fkey" FOREIGN KEY ("headId") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_locations" ADD CONSTRAINT "employee_locations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_locations" ADD CONSTRAINT "employee_locations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_requests" ADD CONSTRAINT "attendance_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."salary_structures" ADD CONSTRAINT "salary_structures_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "public"."salary_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."salary_structure_components" ADD CONSTRAINT "salary_structure_components_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "public"."salary_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."salary_structure_components" ADD CONSTRAINT "salary_structure_components_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."pay_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_salary_structures" ADD CONSTRAINT "employee_salary_structures_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_salary_structures" ADD CONSTRAINT "employee_salary_structures_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "public"."salary_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_salary_components" ADD CONSTRAINT "employee_salary_components_employeeSalaryId_fkey" FOREIGN KEY ("employeeSalaryId") REFERENCES "public"."employee_salary_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."salary_revisions" ADD CONSTRAINT "salary_revisions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payslips" ADD CONSTRAINT "payslips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payslips" ADD CONSTRAINT "payslips_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "public"."payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - Added the required column `latitude` to the `employee_locations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitude` to the `employee_locations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `employee_locations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- DropIndex
DROP INDEX "public"."employee_locations_employeeId_locationId_key";

-- AlterTable
ALTER TABLE "public"."audit_logs" ADD COLUMN     "details" JSONB,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "userName" TEXT;

-- AlterTable - Handle existing data in employee_locations
ALTER TABLE "public"."employee_locations" ADD COLUMN     "isOfficeLocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "officeLocationId" TEXT,
ADD COLUMN     "radius" INTEGER NOT NULL DEFAULT 100,
ALTER COLUMN "locationId" DROP NOT NULL;

-- Add new columns with default values first
ALTER TABLE "public"."employee_locations" ADD COLUMN     "latitude" DECIMAL(10,8) DEFAULT 0.0;
ALTER TABLE "public"."employee_locations" ADD COLUMN     "longitude" DECIMAL(11,8) DEFAULT 0.0;
ALTER TABLE "public"."employee_locations" ADD COLUMN     "name" TEXT DEFAULT 'Default Location';

-- Update existing records with data from related location table
UPDATE "public"."employee_locations" 
SET 
  "latitude" = l."latitude",
  "longitude" = l."longitude",
  "name" = l."name"
FROM "public"."locations" l 
WHERE "public"."employee_locations"."locationId" = l."id";

-- Make the columns NOT NULL after updating existing data
ALTER TABLE "public"."employee_locations" ALTER COLUMN "latitude" SET NOT NULL;
ALTER TABLE "public"."employee_locations" ALTER COLUMN "longitude" SET NOT NULL;
ALTER TABLE "public"."employee_locations" ALTER COLUMN "name" SET NOT NULL;

-- Drop the default values
ALTER TABLE "public"."employee_locations" ALTER COLUMN "latitude" DROP DEFAULT;
ALTER TABLE "public"."employee_locations" ALTER COLUMN "longitude" DROP DEFAULT;
ALTER TABLE "public"."employee_locations" ALTER COLUMN "name" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."leave_approvals" ADD COLUMN     "approverEmail" TEXT,
ADD COLUMN     "notificationSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificationSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."office_locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "radius" INTEGER NOT NULL DEFAULT 100,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "workingHours" JSONB,
    "isHeadOffice" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "office_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "clientName" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."timesheets" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "public"."TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "totalHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."time_entries" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakDuration" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT,
    "taskDescription" TEXT,
    "billableHours" DECIMAL(4,2) NOT NULL,
    "nonBillableHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "office_locations_name_key" ON "public"."office_locations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "office_locations_code_key" ON "public"."office_locations"("code");

-- CreateIndex
CREATE INDEX "office_locations_city_state_idx" ON "public"."office_locations"("city", "state");

-- CreateIndex
CREATE INDEX "office_locations_latitude_longitude_idx" ON "public"."office_locations"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "public"."projects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "public"."projects"("code");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "public"."projects"("status");

-- CreateIndex
CREATE INDEX "timesheets_employeeId_status_idx" ON "public"."timesheets"("employeeId", "status");

-- CreateIndex
CREATE INDEX "timesheets_startDate_endDate_idx" ON "public"."timesheets"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_employeeId_startDate_endDate_key" ON "public"."timesheets"("employeeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "time_entries_employeeId_date_idx" ON "public"."time_entries"("employeeId", "date");

-- CreateIndex
CREATE INDEX "time_entries_projectId_idx" ON "public"."time_entries"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_timesheetId_date_key" ON "public"."time_entries"("timesheetId", "date");

-- CreateIndex
CREATE INDEX "audit_logs_success_idx" ON "public"."audit_logs"("success");

-- CreateIndex
CREATE INDEX "employee_locations_officeLocationId_idx" ON "public"."employee_locations"("officeLocationId");

-- AddForeignKey
ALTER TABLE "public"."employee_locations" ADD CONSTRAINT "employee_locations_officeLocationId_fkey" FOREIGN KEY ("officeLocationId") REFERENCES "public"."office_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheets" ADD CONSTRAINT "timesheets_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheets" ADD CONSTRAINT "timesheets_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."time_entries" ADD CONSTRAINT "time_entries_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "public"."timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."time_entries" ADD CONSTRAINT "time_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

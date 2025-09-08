/*
  Warnings:

  - You are about to alter the column `workHours` on the `attendance_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(4,2)`.
  - You are about to alter the column `overtime` on the `attendance_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(4,2)`.

*/
-- CreateEnum
CREATE TYPE "public"."CheckType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'BREAK_START', 'BREAK_END');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."AttendanceStatus" ADD VALUE 'ON_LEAVE';
ALTER TYPE "public"."AttendanceStatus" ADD VALUE 'HOLIDAY';

-- AlterTable
ALTER TABLE "public"."attendance_records" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ALTER COLUMN "workHours" SET DATA TYPE DECIMAL(4,2),
ALTER COLUMN "overtime" SET DATA TYPE DECIMAL(4,2);

-- CreateTable
CREATE TABLE "public"."check_in_out" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "public"."CheckType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "location" JSONB,
    "method" "public"."AttendanceMethod" NOT NULL,
    "deviceInfo" JSONB,
    "ipAddress" TEXT,
    "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
    "manualReason" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_in_out_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "radius" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "workingHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attendance_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workingHoursPerDay" DECIMAL(4,2) NOT NULL DEFAULT 8.00,
    "workingDaysPerWeek" INTEGER NOT NULL DEFAULT 5,
    "graceTimeMinutes" INTEGER NOT NULL DEFAULT 15,
    "halfDayThresholdHours" DECIMAL(4,2) NOT NULL DEFAULT 4.00,
    "overtimeThresholdHours" DECIMAL(4,2) NOT NULL DEFAULT 8.00,
    "allowFlexiTime" BOOLEAN NOT NULL DEFAULT false,
    "requireGeoFencing" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "check_in_out_employeeId_timestamp_idx" ON "public"."check_in_out"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "check_in_out_type_idx" ON "public"."check_in_out"("type");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "public"."locations"("name");

-- CreateIndex
CREATE INDEX "locations_latitude_longitude_idx" ON "public"."locations"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_policies_name_key" ON "public"."attendance_policies"("name");

-- CreateIndex
CREATE INDEX "attendance_records_employeeId_date_idx" ON "public"."attendance_records"("employeeId", "date");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "public"."attendance_records"("status");

-- CreateIndex
CREATE INDEX "attendance_records_method_idx" ON "public"."attendance_records"("method");

-- AddForeignKey
ALTER TABLE "public"."check_in_out" ADD CONSTRAINT "check_in_out_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "public"."attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

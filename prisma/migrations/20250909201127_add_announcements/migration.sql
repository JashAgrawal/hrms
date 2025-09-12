-- CreateEnum
CREATE TYPE "public"."AnnouncementType" AS ENUM ('GENERAL', 'POLICY', 'EVENT', 'HOLIDAY', 'SYSTEM', 'URGENT', 'CELEBRATION');

-- CreateEnum
CREATE TYPE "public"."AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "public"."AnnouncementType" NOT NULL DEFAULT 'GENERAL',
    "priority" "public"."AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "public"."AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "attachments" JSONB,
    "targetAudience" JSONB,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."announcement_views" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_status_publishedAt_idx" ON "public"."announcements"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "announcements_type_priority_idx" ON "public"."announcements"("type", "priority");

-- CreateIndex
CREATE INDEX "announcements_createdBy_idx" ON "public"."announcements"("createdBy");

-- CreateIndex
CREATE INDEX "announcement_views_employeeId_idx" ON "public"."announcement_views"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_views_announcementId_employeeId_key" ON "public"."announcement_views"("announcementId", "employeeId");

-- AddForeignKey
ALTER TABLE "public"."announcement_views" ADD CONSTRAINT "announcement_views_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "public"."announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."announcement_views" ADD CONSTRAINT "announcement_views_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

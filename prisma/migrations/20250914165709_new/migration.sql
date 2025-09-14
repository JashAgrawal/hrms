/*
  Warnings:

  - You are about to drop the column `category` on the `expense_claims` table. All the data in the column will be lost.
  - You are about to drop the column `receipts` on the `expense_claims` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `expense_claims` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `overallRating` on the `performance_reviews` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(3,2)`.
  - Added the required column `categoryId` to the `expense_claims` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."EmployeeType" AS ENUM ('NORMAL', 'FIELD_EMPLOYEE');

-- CreateEnum
CREATE TYPE "public"."HolidayType" AS ENUM ('PUBLIC', 'COMPANY', 'OPTIONAL', 'RELIGIOUS', 'NATIONAL');

-- CreateEnum
CREATE TYPE "public"."ReimbursementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHEQUE');

-- CreateEnum
CREATE TYPE "public"."PolicyRuleType" AS ENUM ('AMOUNT_LIMIT', 'FREQUENCY_LIMIT', 'APPROVAL_REQUIRED', 'RECEIPT_REQUIRED', 'GPS_REQUIRED');

-- CreateEnum
CREATE TYPE "public"."TravelMode" AS ENUM ('FLIGHT', 'TRAIN', 'BUS', 'CAR', 'TAXI', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TravelRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."CycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'IN_PROGRESS', 'CALIBRATION', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ObjectiveCategory" AS ENUM ('INDIVIDUAL', 'TEAM', 'DEPARTMENT', 'COMPANY', 'PROJECT');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."ObjectiveStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_TRACK', 'AT_RISK', 'BEHIND', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."KeyResultType" AS ENUM ('QUANTITATIVE', 'QUALITATIVE', 'MILESTONE', 'BINARY');

-- CreateEnum
CREATE TYPE "public"."KeyResultStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "public"."ReviewerType" AS ENUM ('SELF', 'MANAGER', 'PEER', 'SUBORDINATE', 'EXTERNAL', 'SKIP_LEVEL');

-- CreateEnum
CREATE TYPE "public"."FeedbackStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "public"."QuestionType" AS ENUM ('RATING', 'TEXT', 'MULTIPLE_CHOICE', 'YES_NO', 'SCALE');

-- CreateEnum
CREATE TYPE "public"."DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'EXPIRED', 'DELETED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "public"."DocumentPermission" AS ENUM ('READ', 'WRITE', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."DocumentAction" AS ENUM ('VIEW', 'DOWNLOAD', 'UPLOAD', 'UPDATE', 'DELETE', 'SHARE', 'APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "public"."ReminderType" AS ENUM ('EXPIRY_WARNING', 'RENEWAL_DUE', 'APPROVAL_PENDING', 'COMPLIANCE_CHECK');

-- CreateEnum
CREATE TYPE "public"."RetentionAction" AS ENUM ('ARCHIVE', 'DELETE', 'REVIEW');

-- CreateEnum
CREATE TYPE "public"."SiteType" AS ENUM ('CLIENT', 'VENDOR', 'PARTNER', 'WAREHOUSE', 'OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SiteVisitStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED');

-- CreateEnum
CREATE TYPE "public"."DistanceCalculationMethod" AS ENUM ('HAVERSINE', 'GOOGLE_MATRIX');

-- CreateEnum
CREATE TYPE "public"."DistanceAnomalyType" AS ENUM ('EXCESSIVE_SPEED', 'IMPOSSIBLE_DISTANCE', 'LOCATION_JUMP', 'MISSING_ROUTE', 'DUPLICATE_CHECKIN');

-- CreateEnum
CREATE TYPE "public"."AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."DocumentCategory" ADD VALUE 'TRAINING';
ALTER TYPE "public"."DocumentCategory" ADD VALUE 'LEGAL';
ALTER TYPE "public"."DocumentCategory" ADD VALUE 'MEDICAL';
ALTER TYPE "public"."DocumentCategory" ADD VALUE 'INSURANCE';
ALTER TYPE "public"."DocumentCategory" ADD VALUE 'TAX';
ALTER TYPE "public"."DocumentCategory" ADD VALUE 'BANK';
ALTER TYPE "public"."DocumentCategory" ADD VALUE 'OTHER';

-- AlterEnum
ALTER TYPE "public"."ExpenseStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ReviewStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "public"."ReviewStatus" ADD VALUE 'CALIBRATED';
ALTER TYPE "public"."ReviewStatus" ADD VALUE 'PUBLISHED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ReviewType" ADD VALUE 'MID_YEAR';
ALTER TYPE "public"."ReviewType" ADD VALUE 'PROJECT_BASED';

-- AlterTable
ALTER TABLE "public"."documents" ADD COLUMN     "approvalStatus" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "isRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "status" "public"."DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tags" JSONB;

-- AlterTable
ALTER TABLE "public"."employees" ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankIFSC" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "employeeType" "public"."EmployeeType" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "public"."expense_claims" DROP COLUMN "category",
DROP COLUMN "receipts",
ADD COLUMN     "billNumber" TEXT,
ADD COLUMN     "categoryId" TEXT NOT NULL,
ADD COLUMN     "distanceTraveled" DECIMAL(8,2),
ADD COLUMN     "isPetrolExpense" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isReimbursable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "merchantAddress" TEXT,
ADD COLUMN     "merchantName" TEXT,
ADD COLUMN     "policyViolations" JSONB,
ADD COLUMN     "reimbursedBy" TEXT,
ADD COLUMN     "reimbursementAmount" DECIMAL(12,2),
ADD COLUMN     "reimbursementBatchId" TEXT,
ADD COLUMN     "taxAmount" DECIMAL(10,2),
ADD COLUMN     "taxRate" DECIMAL(5,2),
ADD COLUMN     "travelRequestId" TEXT,
ADD COLUMN     "vehicleNumber" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "public"."performance_reviews" ADD COLUMN     "achievements" JSONB,
ADD COLUMN     "calibratedAt" TIMESTAMP(3),
ADD COLUMN     "calibratedBy" TEXT,
ADD COLUMN     "calibrationRating" DECIMAL(3,2),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "cycleId" TEXT,
ADD COLUMN     "developmentAreas" JSONB,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "isCalibrated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "peerRating" JSONB,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "subordinateRating" JSONB,
ALTER COLUMN "overallRating" SET DATA TYPE DECIMAL(3,2);

-- DropEnum
DROP TYPE "public"."ExpenseCategory";

-- CreateTable
CREATE TABLE "public"."sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "radius" INTEGER NOT NULL DEFAULT 50,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "description" TEXT,
    "siteType" "public"."SiteType" NOT NULL DEFAULT 'CLIENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_sites" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."site_visits" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkInTime" TIMESTAMP(3) NOT NULL,
    "checkOutTime" TIMESTAMP(3),
    "checkInLocation" JSONB NOT NULL,
    "checkOutLocation" JSONB,
    "purpose" TEXT,
    "notes" TEXT,
    "photos" JSONB,
    "status" "public"."SiteVisitStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "distanceFromSite" DECIMAL(8,2),
    "duration" INTEGER,
    "isValidLocation" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."timesheet_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "employeeId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."timesheet_template_entries" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakDuration" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT,
    "taskDescription" TEXT,
    "billableHours" DECIMAL(4,2) NOT NULL,
    "nonBillableHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_template_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."holidays" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "public"."HolidayType" NOT NULL DEFAULT 'PUBLIC',
    "description" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."optional_leave_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "year" INTEGER NOT NULL,
    "maxSelectableLeaves" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "selectionDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "optional_leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."optional_leave_policy_holidays" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "holidayId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "optional_leave_policy_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_optional_leave_selections" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "holidayId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_optional_leave_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "maxAmount" DECIMAL(12,2),
    "requiresReceipt" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvalLevels" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expense_policy_rules" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" "public"."PolicyRuleType" NOT NULL,
    "ruleValue" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expense_attachments" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expense_approvals" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approverName" TEXT,
    "approverEmail" TEXT,
    "level" INTEGER NOT NULL,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "comments" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notificationSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reimbursement_batches" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "totalClaims" INTEGER NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "referenceNumber" TEXT,
    "notes" TEXT,
    "status" "public"."ReimbursementStatus" NOT NULL DEFAULT 'PROCESSING',
    "processedBy" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reimbursement_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."travel_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "fromLocation" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "estimatedCost" DECIMAL(12,2) NOT NULL,
    "actualCost" DECIMAL(12,2),
    "travelMode" "public"."TravelMode" NOT NULL DEFAULT 'FLIGHT',
    "accommodationRequired" BOOLEAN NOT NULL DEFAULT false,
    "advanceRequired" BOOLEAN NOT NULL DEFAULT false,
    "advanceAmount" DECIMAL(12,2),
    "status" "public"."TravelRequestStatus" NOT NULL DEFAULT 'PENDING',
    "itinerary" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."travel_approvals" (
    "id" TEXT NOT NULL,
    "travelRequestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approverName" TEXT,
    "approverEmail" TEXT,
    "level" INTEGER NOT NULL,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "comments" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notificationSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."petrol_expense_config" (
    "id" TEXT NOT NULL,
    "ratePerKm" DECIMAL(6,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petrol_expense_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monthly_petrol_expenses" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalDistance" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "ratePerKm" DECIMAL(6,2) NOT NULL,
    "status" "public"."ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "autoGenerated" BOOLEAN NOT NULL DEFAULT true,
    "expenseClaimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_petrol_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."performance_cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."ReviewType" NOT NULL DEFAULT 'ANNUAL',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "public"."CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "template" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."objectives" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewId" TEXT,
    "cycleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."ObjectiveCategory" NOT NULL DEFAULT 'INDIVIDUAL',
    "priority" "public"."Priority" NOT NULL DEFAULT 'MEDIUM',
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "status" "public"."ObjectiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "parentId" TEXT,
    "alignedTo" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."key_results" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."KeyResultType" NOT NULL DEFAULT 'QUANTITATIVE',
    "targetValue" DECIMAL(15,2),
    "currentValue" DECIMAL(15,2),
    "unit" TEXT,
    "targetDate" DATE,
    "status" "public"."KeyResultStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."objective_updates" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "progress" DECIMAL(5,2) NOT NULL,
    "comments" TEXT,
    "challenges" TEXT,
    "nextSteps" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updateDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objective_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."key_result_updates" (
    "id" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "currentValue" DECIMAL(15,2) NOT NULL,
    "progress" DECIMAL(5,2) NOT NULL,
    "comments" TEXT,
    "evidence" JSONB,
    "updatedBy" TEXT NOT NULL,
    "updateDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_result_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feedbacks" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT,
    "employeeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerType" "public"."ReviewerType" NOT NULL,
    "relationship" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "responses" JSONB,
    "overallRating" DECIMAL(3,2),
    "strengths" TEXT,
    "improvements" TEXT,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3),
    "dueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feedback_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reviewerType" "public"."ReviewerType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feedback_questions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "type" "public"."QuestionType" NOT NULL DEFAULT 'RATING',
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "changeLog" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_approvals" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approverName" TEXT,
    "approverEmail" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "comments" TEXT,
    "digitalSignature" JSONB,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notificationSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_shares" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sharedWith" TEXT NOT NULL,
    "sharedBy" TEXT NOT NULL,
    "permissions" "public"."DocumentPermission" NOT NULL DEFAULT 'READ',
    "expiresAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_access_logs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" "public"."DocumentAction" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" JSONB,
    "deviceInfo" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_reminders" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reminderType" "public"."ReminderType" NOT NULL,
    "reminderDate" TIMESTAMP(3) NOT NULL,
    "message" TEXT,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."DocumentCategory" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "validityPeriod" INTEGER,
    "approvalLevels" INTEGER NOT NULL DEFAULT 1,
    "approvers" JSONB,
    "reminderDays" JSONB,
    "template" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_retention_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."DocumentCategory",
    "retentionPeriod" INTEGER NOT NULL,
    "action" "public"."RetentionAction" NOT NULL DEFAULT 'ARCHIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."security_settings" (
    "id" TEXT NOT NULL,
    "encryptionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "watermarkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "accessLoggingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "downloadRestrictions" BOOLEAN NOT NULL DEFAULT false,
    "ipWhitelist" JSONB NOT NULL DEFAULT '[]',
    "maxFileSize" INTEGER NOT NULL DEFAULT 10485760,
    "allowedFileTypes" JSONB NOT NULL DEFAULT '["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"]',
    "passwordProtection" BOOLEAN NOT NULL DEFAULT false,
    "expiryEnforcement" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."distance_tracking_points" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "accuracy" DECIMAL(6,2),
    "siteId" TEXT,
    "siteName" TEXT,
    "distanceFromPrevious" DECIMAL(10,2),
    "durationFromPrevious" INTEGER,
    "calculationMethod" "public"."DistanceCalculationMethod" NOT NULL DEFAULT 'HAVERSINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distance_tracking_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_distance_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalDistance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalDuration" INTEGER,
    "checkInCount" INTEGER NOT NULL DEFAULT 0,
    "isValidated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_distance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."distance_anomalies" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkInPointId" TEXT NOT NULL,
    "type" "public"."DistanceAnomalyType" NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "public"."AnomalySeverity" NOT NULL DEFAULT 'MEDIUM',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distance_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."distance_calculation_configs" (
    "id" TEXT NOT NULL,
    "maxSpeedKmh" INTEGER NOT NULL DEFAULT 120,
    "maxDistancePerDayKm" INTEGER NOT NULL DEFAULT 500,
    "minTimeBetweenCheckins" INTEGER NOT NULL DEFAULT 5,
    "enableGoogleMatrixAPI" BOOLEAN NOT NULL DEFAULT true,
    "anomalyDetectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "googleMapsApiKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distance_calculation_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_name_key" ON "public"."sites"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "public"."sites"("code");

-- CreateIndex
CREATE INDEX "sites_city_state_idx" ON "public"."sites"("city", "state");

-- CreateIndex
CREATE INDEX "sites_latitude_longitude_idx" ON "public"."sites"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "sites_siteType_idx" ON "public"."sites"("siteType");

-- CreateIndex
CREATE INDEX "employee_sites_employeeId_idx" ON "public"."employee_sites"("employeeId");

-- CreateIndex
CREATE INDEX "employee_sites_siteId_idx" ON "public"."employee_sites"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_sites_employeeId_siteId_key" ON "public"."employee_sites"("employeeId", "siteId");

-- CreateIndex
CREATE INDEX "site_visits_employeeId_date_idx" ON "public"."site_visits"("employeeId", "date");

-- CreateIndex
CREATE INDEX "site_visits_siteId_date_idx" ON "public"."site_visits"("siteId", "date");

-- CreateIndex
CREATE INDEX "site_visits_status_idx" ON "public"."site_visits"("status");

-- CreateIndex
CREATE INDEX "timesheet_templates_employeeId_isDefault_idx" ON "public"."timesheet_templates"("employeeId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_templates_employeeId_name_key" ON "public"."timesheet_templates"("employeeId", "name");

-- CreateIndex
CREATE INDEX "timesheet_template_entries_templateId_idx" ON "public"."timesheet_template_entries"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_template_entries_templateId_dayOfWeek_key" ON "public"."timesheet_template_entries"("templateId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "holidays_date_isActive_idx" ON "public"."holidays"("date", "isActive");

-- CreateIndex
CREATE INDEX "holidays_year_isActive_idx" ON "public"."holidays"("year", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_name_date_key" ON "public"."holidays"("name", "date");

-- CreateIndex
CREATE UNIQUE INDEX "optional_leave_policies_name_key" ON "public"."optional_leave_policies"("name");

-- CreateIndex
CREATE INDEX "optional_leave_policies_year_isActive_idx" ON "public"."optional_leave_policies"("year", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "optional_leave_policy_holidays_policyId_holidayId_key" ON "public"."optional_leave_policy_holidays"("policyId", "holidayId");

-- CreateIndex
CREATE INDEX "employee_optional_leave_selections_employeeId_policyId_idx" ON "public"."employee_optional_leave_selections"("employeeId", "policyId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_optional_leave_selections_employeeId_policyId_holi_key" ON "public"."employee_optional_leave_selections"("employeeId", "policyId", "holidayId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "public"."expense_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_code_key" ON "public"."expense_categories"("code");

-- CreateIndex
CREATE INDEX "expense_approvals_approverId_status_idx" ON "public"."expense_approvals"("approverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "expense_approvals_expenseId_level_key" ON "public"."expense_approvals"("expenseId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursement_batches_batchId_key" ON "public"."reimbursement_batches"("batchId");

-- CreateIndex
CREATE INDEX "reimbursement_batches_status_idx" ON "public"."reimbursement_batches"("status");

-- CreateIndex
CREATE INDEX "reimbursement_batches_processedAt_idx" ON "public"."reimbursement_batches"("processedAt");

-- CreateIndex
CREATE INDEX "travel_requests_employeeId_status_idx" ON "public"."travel_requests"("employeeId", "status");

-- CreateIndex
CREATE INDEX "travel_requests_startDate_endDate_idx" ON "public"."travel_requests"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "travel_approvals_approverId_status_idx" ON "public"."travel_approvals"("approverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "travel_approvals_travelRequestId_level_key" ON "public"."travel_approvals"("travelRequestId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_petrol_expenses_expenseClaimId_key" ON "public"."monthly_petrol_expenses"("expenseClaimId");

-- CreateIndex
CREATE INDEX "monthly_petrol_expenses_employeeId_year_idx" ON "public"."monthly_petrol_expenses"("employeeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_petrol_expenses_employeeId_month_year_key" ON "public"."monthly_petrol_expenses"("employeeId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "performance_cycles_name_key" ON "public"."performance_cycles"("name");

-- CreateIndex
CREATE INDEX "performance_cycles_status_isActive_idx" ON "public"."performance_cycles"("status", "isActive");

-- CreateIndex
CREATE INDEX "performance_cycles_startDate_endDate_idx" ON "public"."performance_cycles"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "objectives_employeeId_status_idx" ON "public"."objectives"("employeeId", "status");

-- CreateIndex
CREATE INDEX "objectives_cycleId_idx" ON "public"."objectives"("cycleId");

-- CreateIndex
CREATE INDEX "objectives_parentId_idx" ON "public"."objectives"("parentId");

-- CreateIndex
CREATE INDEX "key_results_objectiveId_idx" ON "public"."key_results"("objectiveId");

-- CreateIndex
CREATE INDEX "objective_updates_objectiveId_updateDate_idx" ON "public"."objective_updates"("objectiveId", "updateDate");

-- CreateIndex
CREATE INDEX "key_result_updates_keyResultId_updateDate_idx" ON "public"."key_result_updates"("keyResultId", "updateDate");

-- CreateIndex
CREATE INDEX "feedbacks_employeeId_reviewerType_idx" ON "public"."feedbacks"("employeeId", "reviewerType");

-- CreateIndex
CREATE INDEX "feedbacks_reviewerId_idx" ON "public"."feedbacks"("reviewerId");

-- CreateIndex
CREATE INDEX "feedbacks_reviewId_idx" ON "public"."feedbacks"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_templates_name_key" ON "public"."feedback_templates"("name");

-- CreateIndex
CREATE INDEX "feedback_questions_templateId_order_idx" ON "public"."feedback_questions"("templateId", "order");

-- CreateIndex
CREATE INDEX "document_versions_documentId_idx" ON "public"."document_versions"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_version_key" ON "public"."document_versions"("documentId", "version");

-- CreateIndex
CREATE INDEX "document_approvals_approverId_status_idx" ON "public"."document_approvals"("approverId", "status");

-- CreateIndex
CREATE INDEX "document_approvals_documentId_idx" ON "public"."document_approvals"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_approvals_documentId_level_key" ON "public"."document_approvals"("documentId", "level");

-- CreateIndex
CREATE INDEX "document_shares_documentId_idx" ON "public"."document_shares"("documentId");

-- CreateIndex
CREATE INDEX "document_shares_sharedWith_idx" ON "public"."document_shares"("sharedWith");

-- CreateIndex
CREATE INDEX "document_access_logs_documentId_timestamp_idx" ON "public"."document_access_logs"("documentId", "timestamp");

-- CreateIndex
CREATE INDEX "document_access_logs_userId_idx" ON "public"."document_access_logs"("userId");

-- CreateIndex
CREATE INDEX "document_access_logs_action_idx" ON "public"."document_access_logs"("action");

-- CreateIndex
CREATE INDEX "document_reminders_documentId_idx" ON "public"."document_reminders"("documentId");

-- CreateIndex
CREATE INDEX "document_reminders_employeeId_reminderDate_idx" ON "public"."document_reminders"("employeeId", "reminderDate");

-- CreateIndex
CREATE INDEX "document_reminders_reminderDate_isSent_idx" ON "public"."document_reminders"("reminderDate", "isSent");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_name_key" ON "public"."document_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "document_retention_policies_name_key" ON "public"."document_retention_policies"("name");

-- CreateIndex
CREATE INDEX "distance_tracking_points_employeeId_timestamp_idx" ON "public"."distance_tracking_points"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "distance_tracking_points_timestamp_idx" ON "public"."distance_tracking_points"("timestamp");

-- CreateIndex
CREATE INDEX "daily_distance_records_employeeId_date_idx" ON "public"."daily_distance_records"("employeeId", "date");

-- CreateIndex
CREATE INDEX "daily_distance_records_date_idx" ON "public"."daily_distance_records"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_distance_records_employeeId_date_key" ON "public"."daily_distance_records"("employeeId", "date");

-- CreateIndex
CREATE INDEX "distance_anomalies_employeeId_date_idx" ON "public"."distance_anomalies"("employeeId", "date");

-- CreateIndex
CREATE INDEX "distance_anomalies_type_severity_idx" ON "public"."distance_anomalies"("type", "severity");

-- CreateIndex
CREATE INDEX "distance_anomalies_isResolved_idx" ON "public"."distance_anomalies"("isResolved");

-- CreateIndex
CREATE INDEX "documents_employeeId_category_idx" ON "public"."documents"("employeeId", "category");

-- CreateIndex
CREATE INDEX "documents_status_approvalStatus_idx" ON "public"."documents"("status", "approvalStatus");

-- CreateIndex
CREATE INDEX "documents_expiryDate_idx" ON "public"."documents"("expiryDate");

-- CreateIndex
CREATE INDEX "documents_uploadedBy_idx" ON "public"."documents"("uploadedBy");

-- CreateIndex
CREATE INDEX "expense_claims_employeeId_status_idx" ON "public"."expense_claims"("employeeId", "status");

-- CreateIndex
CREATE INDEX "expense_claims_expenseDate_idx" ON "public"."expense_claims"("expenseDate");

-- CreateIndex
CREATE INDEX "expense_claims_categoryId_idx" ON "public"."expense_claims"("categoryId");

-- CreateIndex
CREATE INDEX "performance_reviews_employeeId_period_idx" ON "public"."performance_reviews"("employeeId", "period");

-- CreateIndex
CREATE INDEX "performance_reviews_cycleId_idx" ON "public"."performance_reviews"("cycleId");

-- CreateIndex
CREATE INDEX "performance_reviews_status_idx" ON "public"."performance_reviews"("status");

-- AddForeignKey
ALTER TABLE "public"."employee_sites" ADD CONSTRAINT "employee_sites_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_sites" ADD CONSTRAINT "employee_sites_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."site_visits" ADD CONSTRAINT "site_visits_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."site_visits" ADD CONSTRAINT "site_visits_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheet_templates" ADD CONSTRAINT "timesheet_templates_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheet_template_entries" ADD CONSTRAINT "timesheet_template_entries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."timesheet_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timesheet_template_entries" ADD CONSTRAINT "timesheet_template_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."optional_leave_policy_holidays" ADD CONSTRAINT "optional_leave_policy_holidays_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."optional_leave_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."optional_leave_policy_holidays" ADD CONSTRAINT "optional_leave_policy_holidays_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "public"."holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_optional_leave_selections" ADD CONSTRAINT "employee_optional_leave_selections_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_optional_leave_selections" ADD CONSTRAINT "employee_optional_leave_selections_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."optional_leave_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_optional_leave_selections" ADD CONSTRAINT "employee_optional_leave_selections_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "public"."holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expense_policy_rules" ADD CONSTRAINT "expense_policy_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."expense_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expense_claims" ADD CONSTRAINT "expense_claims_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expense_claims" ADD CONSTRAINT "expense_claims_travelRequestId_fkey" FOREIGN KEY ("travelRequestId") REFERENCES "public"."travel_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expense_claims" ADD CONSTRAINT "expense_claims_reimbursementBatchId_fkey" FOREIGN KEY ("reimbursementBatchId") REFERENCES "public"."reimbursement_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expense_attachments" ADD CONSTRAINT "expense_attachments_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "public"."expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expense_approvals" ADD CONSTRAINT "expense_approvals_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "public"."expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."travel_requests" ADD CONSTRAINT "travel_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."travel_approvals" ADD CONSTRAINT "travel_approvals_travelRequestId_fkey" FOREIGN KEY ("travelRequestId") REFERENCES "public"."travel_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."monthly_petrol_expenses" ADD CONSTRAINT "monthly_petrol_expenses_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."monthly_petrol_expenses" ADD CONSTRAINT "monthly_petrol_expenses_expenseClaimId_fkey" FOREIGN KEY ("expenseClaimId") REFERENCES "public"."expense_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."performance_reviews" ADD CONSTRAINT "performance_reviews_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "public"."performance_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."objectives" ADD CONSTRAINT "objectives_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."objectives" ADD CONSTRAINT "objectives_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."performance_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."objectives" ADD CONSTRAINT "objectives_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "public"."performance_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."objectives" ADD CONSTRAINT "objectives_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."key_results" ADD CONSTRAINT "key_results_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "public"."objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."objective_updates" ADD CONSTRAINT "objective_updates_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "public"."objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."key_result_updates" ADD CONSTRAINT "key_result_updates_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "public"."key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feedbacks" ADD CONSTRAINT "feedbacks_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feedbacks" ADD CONSTRAINT "feedbacks_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feedbacks" ADD CONSTRAINT "feedbacks_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."performance_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feedback_questions" ADD CONSTRAINT "feedback_questions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."feedback_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_approvals" ADD CONSTRAINT "document_approvals_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_shares" ADD CONSTRAINT "document_shares_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_access_logs" ADD CONSTRAINT "document_access_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_reminders" ADD CONSTRAINT "document_reminders_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."distance_tracking_points" ADD CONSTRAINT "distance_tracking_points_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_distance_records" ADD CONSTRAINT "daily_distance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."distance_anomalies" ADD CONSTRAINT "distance_anomalies_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."distance_anomalies" ADD CONSTRAINT "distance_anomalies_employeeId_date_fkey" FOREIGN KEY ("employeeId", "date") REFERENCES "public"."daily_distance_records"("employeeId", "date") ON DELETE CASCADE ON UPDATE CASCADE;

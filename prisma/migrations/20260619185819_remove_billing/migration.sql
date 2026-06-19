/*
  Warnings:

  - You are about to drop the column `invitedById` on the `Invite` table. All the data in the column will be lost.
  - You are about to drop the column `revokedAt` on the `Invite` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Invite" DROP CONSTRAINT "Invite_invitedById_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_workspaceId_fkey";

-- DropIndex
DROP INDEX "ActivityLog_workspaceId_createdAt_idx";

-- DropIndex
DROP INDEX "Comment_workspaceId_createdAt_idx";

-- DropIndex
DROP INDEX "Invite_expiresAt_idx";

-- DropIndex
DROP INDEX "Invite_token_idx";

-- DropIndex
DROP INDEX "Invite_workspaceId_email_idx";

-- DropIndex
DROP INDEX "Issue_priority_idx";

-- DropIndex
DROP INDEX "Issue_projectId_position_idx";

-- DropIndex
DROP INDEX "Issue_projectId_status_idx";

-- DropIndex
DROP INDEX "Issue_sprintId_status_idx";

-- DropIndex
DROP INDEX "Issue_workspaceId_position_idx";

-- DropIndex
DROP INDEX "Issue_workspaceId_status_idx";

-- DropIndex
DROP INDEX "Project_workspaceId_archived_idx";

-- DropIndex
DROP INDEX "Project_workspaceId_createdAt_idx";

-- DropIndex
DROP INDEX "Sprint_projectId_status_idx";

-- DropIndex
DROP INDEX "Sprint_workspaceId_status_idx";

-- DropIndex
DROP INDEX "SprintReport_sprintId_idx";

-- DropIndex
DROP INDEX "SprintReport_workspaceId_createdAt_idx";

-- AlterTable
ALTER TABLE "ActivityLog" ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Invite" DROP COLUMN "invitedById",
DROP COLUMN "revokedAt",
ALTER COLUMN "expiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SprintReport" ALTER COLUMN "totalIssues" SET DEFAULT 0,
ALTER COLUMN "completedIssues" SET DEFAULT 0,
ALTER COLUMN "completionRate" SET DEFAULT 0,
ALTER COLUMN "velocity" SET DEFAULT 0,
ALTER COLUMN "burndownData" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "imageUrl",
ADD COLUMN     "description" TEXT,
ALTER COLUMN "slug" DROP NOT NULL;

-- DropTable
DROP TABLE "Subscription";

-- DropEnum
DROP TYPE "Plan";

-- CreateIndex
CREATE INDEX "Issue_archived_idx" ON "Issue"("archived");

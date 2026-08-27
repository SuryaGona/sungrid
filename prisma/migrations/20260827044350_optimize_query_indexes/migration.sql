-- DropIndex
DROP INDEX "ActivityLog_createdAt_idx";

-- DropIndex
DROP INDEX "ActivityLog_workspaceId_idx";

-- DropIndex
DROP INDEX "Comment_issueId_idx";

-- DropIndex
DROP INDEX "Issue_archived_idx";

-- DropIndex
DROP INDEX "Issue_sprintId_idx";

-- DropIndex
DROP INDEX "Issue_status_idx";

-- DropIndex
DROP INDEX "Issue_workspaceId_idx";

-- DropIndex
DROP INDEX "Membership_workspaceId_idx";

-- DropIndex
DROP INDEX "Project_workspaceId_idx";

-- DropIndex
DROP INDEX "Sprint_status_idx";

-- DropIndex
DROP INDEX "Sprint_workspaceId_idx";

-- DropIndex
DROP INDEX "SprintReport_workspaceId_idx";

-- CreateIndex
CREATE INDEX "ActivityLog_workspaceId_createdAt_idx" ON "ActivityLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_issueId_createdAt_idx" ON "Comment"("issueId", "createdAt");

-- CreateIndex
CREATE INDEX "Issue_workspaceId_archived_status_idx" ON "Issue"("workspaceId", "archived", "status");

-- CreateIndex
CREATE INDEX "Issue_workspaceId_projectId_archived_sprintId_createdAt_idx" ON "Issue"("workspaceId", "projectId", "archived", "sprintId", "createdAt");

-- CreateIndex
CREATE INDEX "Issue_workspaceId_projectId_archived_updatedAt_idx" ON "Issue"("workspaceId", "projectId", "archived", "updatedAt");

-- CreateIndex
CREATE INDEX "Issue_sprintId_archived_createdAt_idx" ON "Issue"("sprintId", "archived", "createdAt");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_createdAt_idx" ON "Membership"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_workspaceId_createdAt_idx" ON "Project"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_workspaceId_archived_idx" ON "Project"("workspaceId", "archived");

-- CreateIndex
CREATE INDEX "Sprint_workspaceId_projectId_createdAt_idx" ON "Sprint"("workspaceId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Sprint_workspaceId_status_idx" ON "Sprint"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "SprintReport_workspaceId_createdAt_idx" ON "SprintReport"("workspaceId", "createdAt");
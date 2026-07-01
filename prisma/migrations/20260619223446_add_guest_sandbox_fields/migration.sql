-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_isGuest_idx" ON "User"("isGuest");

-- CreateIndex
CREATE INDEX "Workspace_isGuest_idx" ON "Workspace"("isGuest");

-- CreateIndex
CREATE INDEX "Workspace_expiresAt_idx" ON "Workspace"("expiresAt");

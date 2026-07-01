import { prisma } from "@/lib/db";

type ActivityMetadataValue =
  | string
  | number
  | boolean
  | null
  | ActivityMetadataValue[]
  | { [key: string]: ActivityMetadataValue };

type ActivityMetadata = Record<string, ActivityMetadataValue>;

export type LogActivityInput = {
  workspaceId: string;
  userId?: string | null;
  projectId?: string | null;
  issueId?: string | null;
  sprintId?: string | null;
  action: string;
  description: string;
  metadata?: ActivityMetadata;
};

export async function logActivity({
  workspaceId,
  userId,
  projectId,
  issueId,
  sprintId,
  action,
  description,
  metadata,
}: LogActivityInput) {
  await prisma.activityLog.create({
    data: {
      workspaceId,
      userId: userId ?? null,
      projectId: projectId ?? null,
      issueId: issueId ?? null,
      sprintId: sprintId ?? null,
      action,
      description,
      metadata: metadata ?? undefined,
    },
  });
}
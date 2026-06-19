import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { retryAsync } from "@/lib/retry";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export class WorkspaceDatabaseError extends Error {
  constructor() {
    super("WORKSPACE_DATABASE_ERROR");
    this.name = "WorkspaceDatabaseError";
  }
}

export async function requireWorkspaceAccess(workspaceId: string) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  let userWithMembership;

  try {
    userWithMembership = await retryAsync(
      () =>
        prisma.user.findUnique({
          where: {
            clerkId: userId,
          },
          include: {
            memberships: {
              where: {
                workspaceId,
              },
              include: {
                workspace: true,
              },
            },
          },
        }),
      {
        retries: 3,
        delayMs: 700,
        label: "workspace access database lookup",
      },
    );
  } catch (error) {
    console.error("Workspace auth database check failed after retries:", error);
    throw new WorkspaceDatabaseError();
  }

  const membership = userWithMembership?.memberships[0];

  if (!userWithMembership || !membership) {
    redirect("/onboarding");
  }

  return {
    clerkUserId: userId,
    user: userWithMembership,
    membership,
    workspace: membership.workspace,
  };
}

export async function requireWorkspaceRole(
  workspaceId: string,
  allowedRoles: WorkspaceRole[],
) {
  const context = await requireWorkspaceAccess(workspaceId);

  if (!allowedRoles.includes(context.membership.role as WorkspaceRole)) {
    redirect(`/dashboard/${workspaceId}`);
  }

  return context;
}
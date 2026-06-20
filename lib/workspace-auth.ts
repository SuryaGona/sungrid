import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { retryAsync } from "@/lib/retry";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

const GUEST_COOKIE_NAME = "sungrid_guest_user_id";

export class WorkspaceDatabaseError extends Error {
  constructor() {
    super("WORKSPACE_DATABASE_ERROR");
    this.name = "WorkspaceDatabaseError";
  }
}

async function getAuthenticatedUser(workspaceId: string) {
  const { userId } = await auth();

  if (userId) {
    return retryAsync(
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
  }

  const cookieStore = await cookies();
  const guestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value;

  if (!guestUserId) {
    return null;
  }

  return retryAsync(
    () =>
      prisma.user.findFirst({
        where: {
          id: guestUserId,
          isGuest: true,
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
      label: "guest workspace access database lookup",
    },
  );
}

export async function requireWorkspaceAccess(workspaceId: string) {
  let userWithMembership;

  try {
    userWithMembership = await getAuthenticatedUser(workspaceId);
  } catch (error) {
    console.error("Workspace auth database check failed after retries:", error);
    throw new WorkspaceDatabaseError();
  }

  const membership = userWithMembership?.memberships[0];

  if (!userWithMembership || !membership) {
    redirect("/sign-in");
  }

  const workspace = membership.workspace;

  if (
    workspace.isGuest &&
    workspace.expiresAt &&
    workspace.expiresAt.getTime() < Date.now()
  ) {
    redirect("/");
  }

  return {
    clerkUserId: userWithMembership.clerkId,
    user: userWithMembership,
    membership,
    workspace,
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
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { retryAsync } from "@/lib/retry";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
type AuthMode = "clerk" | "guest";

const GUEST_COOKIE_NAME = "sungrid_guest_user_id";

export class WorkspaceDatabaseError extends Error {
  constructor() {
    super("WORKSPACE_DATABASE_ERROR");
    this.name = "WorkspaceDatabaseError";
  }
}

async function findClerkUser(clerkId: string, workspaceId: string) {
  return retryAsync(
    () =>
      prisma.user.findUnique({
        where: {
          clerkId,
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
      label: "Clerk workspace access lookup",
    },
  );
}

async function findGuestUser(workspaceId: string) {
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
      label: "Guest workspace access lookup",
    },
  );
}

async function getAuthenticatedUser(workspaceId: string) {
  const { userId } = await auth();

  if (userId) {
    const clerkUser = await findClerkUser(userId, workspaceId);

    if (clerkUser) {
      return {
        authMode: "clerk" as AuthMode,
        user: clerkUser,
      };
    }

    const guestUser = await findGuestUser(workspaceId);

    if (guestUser) {
      return {
        authMode: "guest" as AuthMode,
        user: guestUser,
      };
    }

    return null;
  }

  const guestUser = await findGuestUser(workspaceId);

  if (!guestUser) {
    return null;
  }

  return {
    authMode: "guest" as AuthMode,
    user: guestUser,
  };
}

export async function requireWorkspaceAccess(workspaceId: string) {
  let authenticatedUser;

  try {
    authenticatedUser = await getAuthenticatedUser(workspaceId);
  } catch (error) {
    console.error("Workspace access lookup failed:", {
      workspaceId,
      error,
    });

    throw new WorkspaceDatabaseError();
  }

  if (!authenticatedUser) {
    redirect("/");
  }

  const membership = authenticatedUser.user.memberships[0];

  if (!membership) {
    if (authenticatedUser.authMode === "clerk") {
      redirect("/dashboard");
    }

    redirect("/");
  }

  const workspace = membership.workspace;

  if (
    workspace.isGuest &&
    workspace.expiresAt &&
    workspace.expiresAt.getTime() <= Date.now()
  ) {
    redirect("/?guest=expired");
  }

  return {
    authMode: authenticatedUser.authMode,
    clerkUserId:
      authenticatedUser.authMode === "clerk"
        ? authenticatedUser.user.clerkId
        : null,
    user: authenticatedUser.user,
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
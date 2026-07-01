import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";

const GUEST_COOKIE_NAME = "sungrid_guest_user_id";

const ISSUE_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
] as const;

const moveIssueSchema = z.object({
  issueId: z.string().min(1),
  status: z.enum(ISSUE_STATUSES),
});

type MoveIssueRouteProps = {
  params: Promise<{
    workspaceId: string;
    projectId: string;
  }>;
};

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function getRequestUserWithMembership(workspaceId: string) {
  const { userId } = await auth();

  if (userId) {
    return prisma.user.findUnique({
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
    });
  }

  const cookieStore = await cookies();
  const guestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value;

  if (!guestUserId) {
    return null;
  }

  return prisma.user.findFirst({
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
  });
}

export async function PATCH(request: Request, { params }: MoveIssueRouteProps) {
  const { workspaceId, projectId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = moveIssueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
      },
      {
        status: 400,
      },
    );
  }

  const { issueId, status } = parsed.data;

  const userWithMembership = await getRequestUserWithMembership(workspaceId);
  const membership = userWithMembership?.memberships[0];
  const workspace = membership?.workspace;

  if (!userWithMembership || !membership || !workspace) {
    return NextResponse.json(
      {
        error: "Forbidden",
      },
      {
        status: 403,
      },
    );
  }

  if (
    workspace.isGuest &&
    workspace.expiresAt &&
    workspace.expiresAt.getTime() < Date.now()
  ) {
    return NextResponse.json(
      {
        error: "Guest workspace expired",
      },
      {
        status: 403,
      },
    );
  }

  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      workspaceId,
      projectId,
      archived: false,
    },
    include: {
      project: true,
    },
  });

  if (!issue) {
    return NextResponse.json(
      {
        error: "Issue not found",
      },
      {
        status: 404,
      },
    );
  }

  if (issue.project.archived) {
    return NextResponse.json(
      {
        error: "Archived projects are read-only",
      },
      {
        status: 400,
      },
    );
  }

  if (issue.status === status) {
    return NextResponse.json({
      issue,
    });
  }

  const targetColumnCount = await prisma.issue.count({
    where: {
      workspaceId,
      projectId,
      status,
      archived: false,
    },
  });

  const oldStatus = issue.status;

  const updatedIssue = await prisma.issue.update({
    where: {
      id: issue.id,
    },
    data: {
      status,
      position: targetColumnCount + 1,
    },
  });

  await logActivity({
    workspaceId,
    userId: userWithMembership.id,
    projectId,
    issueId: issue.id,
    action: "issue.moved",
    description: `Moved issue "${issue.title}" from ${formatEnum(
      oldStatus,
    )} to ${formatEnum(status)}.`,
    metadata: {
      issueId: issue.id,
      issueTitle: issue.title,
      projectId,
      projectName: issue.project.name,
      oldStatus,
      newStatus: status,
    },
  });

  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/board`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(
    `/dashboard/${workspaceId}/projects/${projectId}/issues/${issue.id}`,
  );
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  return NextResponse.json({
    issue: updatedIssue,
  });
}
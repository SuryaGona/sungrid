import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";

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

export async function PATCH(request: Request, { params }: MoveIssueRouteProps) {
  const { workspaceId, projectId } = await params;

  const clerkUser = await currentUser();

  if (!clerkUser) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = moveIssueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
      },
      {
        status: 400,
      }
    );
  }

  const { issueId, status } = parsed.data;

  const user = await prisma.user.findUnique({
    where: {
      clerkId: clerkUser.id,
    },
    include: {
      memberships: {
        where: {
          workspaceId,
        },
      },
    },
  });

  const membership = user?.memberships[0];

  if (!user || !membership) {
    return NextResponse.json(
      {
        error: "Forbidden",
      },
      {
        status: 403,
      }
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
      }
    );
  }

  if (issue.project.archived) {
    return NextResponse.json(
      {
        error: "Archived projects are read-only",
      },
      {
        status: 400,
      }
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
    userId: user.id,
    projectId,
    issueId: issue.id,
    action: "issue.moved",
    description: `Moved issue "${issue.title}" from ${formatEnum(
      oldStatus
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
    `/dashboard/${workspaceId}/projects/${projectId}/issues/${issue.id}`
  );
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  return NextResponse.json({
    issue: updatedIssue,
  });
}
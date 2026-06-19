import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/workspace-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IssueDetailPageProps = {
  params: Promise<{
    workspaceId: string;
    projectId: string;
    issueId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

const ISSUE_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
] as const;

const ISSUE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const ISSUE_TYPES = ["TASK", "BUG", "FEATURE", "STORY"] as const;

const updateIssueSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  issueId: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(1, "Issue title is required.")
    .max(120, "Issue title must be 120 characters or less."),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or less.")
    .optional(),
  status: z.enum(ISSUE_STATUSES),
  priority: z.enum(ISSUE_PRIORITIES),
  type: z.enum(ISSUE_TYPES),
  storyPoints: z.preprocess((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    return Number(value);
  }, z.number().int().min(0).max(100).nullable()),
  assigneeId: z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") {
      return null;
    }

    return value;
  }, z.string().nullable().optional()),
});

const commentSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  issueId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, "Comment is required.")
    .max(1000, "Comment must be 1000 characters or less."),
});

const issueActionSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  issueId: z.string().min(1),
});

function issuePageUrl(
  workspaceId: string,
  projectId: string,
  issueId: string,
  params?: Record<string, string>,
) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();

  if (!query) {
    return `/dashboard/${workspaceId}/projects/${projectId}/issues/${issueId}`;
  }

  return `/dashboard/${workspaceId}/projects/${projectId}/issues/${issueId}?${query}`;
}

function getMessage(value: string | undefined) {
  if (!value) {
    return null;
  }

  const messages: Record<string, string> = {
    "issue-not-found": "Issue not found.",
    "project-archived": "Archived projects are read-only.",
    "issue-archived-readonly": "Archived issues are read-only until restored.",
    "invalid-issue": "Check the issue title, story points, and selected fields.",
    "invalid-comment": "Comment is required and must be 1000 characters or less.",
    "not-authorized": "You are not allowed to perform that action.",
    "assignee-not-member": "Selected assignee is not a member of this workspace.",
    "issue-updated": "Issue updated successfully.",
    "comment-added": "Comment added successfully.",
    "issue-archived": "Issue archived successfully.",
    "issue-restored": "Issue restored successfully.",
  };

  return messages[value] ?? null;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function canManageIssue(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

async function updateIssue(formData: FormData) {
  "use server";

  const workspaceId = String(formData.get("workspaceId") || "");
  const projectId = String(formData.get("projectId") || "");
  const issueId = String(formData.get("issueId") || "");

  if (!workspaceId || !projectId || !issueId) {
    redirect("/dashboard");
  }

  const parsed = updateIssueSchema.safeParse({
    workspaceId,
    projectId,
    issueId,
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    type: formData.get("type"),
    storyPoints: formData.get("storyPoints"),
    assigneeId: formData.get("assigneeId"),
  });

  if (!parsed.success) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "invalid-issue",
      }),
    );
  }

  const { user, membership } = await requireWorkspaceAccess(workspaceId);

  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      workspaceId,
      projectId,
    },
    include: {
      project: true,
    },
  });

  if (!issue) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "issue-not-found",
      }),
    );
  }

  if (issue.project.archived) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "project-archived",
      }),
    );
  }

  if (issue.archived) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "issue-archived-readonly",
      }),
    );
  }

  const canEditIssue =
    canManageIssue(membership.role) ||
    issue.reporterId === user.id ||
    issue.assigneeId === user.id;

  if (!canEditIssue) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "not-authorized",
      }),
    );
  }

  const {
    title,
    description,
    status,
    priority,
    type,
    storyPoints,
    assigneeId,
  } = parsed.data;

  if (assigneeId) {
    const assigneeMembership = await prisma.membership.findFirst({
      where: {
        workspaceId,
        userId: assigneeId,
      },
      select: {
        id: true,
      },
    });

    if (!assigneeMembership) {
      redirect(
        issuePageUrl(workspaceId, projectId, issueId, {
          error: "assignee-not-member",
        }),
      );
    }
  }

  const oldValues = {
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    type: issue.type,
    storyPoints: issue.storyPoints,
    assigneeId: issue.assigneeId,
  };

  await prisma.issue.updateMany({
    where: {
      id: issue.id,
      workspaceId,
      projectId,
    },
    data: {
      title,
      description: description || null,
      status,
      priority,
      type,
      storyPoints,
      assigneeId: assigneeId || null,
    },
  });

  await logActivity({
    workspaceId,
    userId: user.id,
    projectId,
    issueId,
    action: "issue.updated",
    description: `Updated issue "${title}".`,
    metadata: {
      issueId,
      projectId,
      oldValues,
      newValues: {
        title,
        description: description || null,
        status,
        priority,
        type,
        storyPoints,
        assigneeId: assigneeId || null,
      },
    },
  });

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/board`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(
    `/dashboard/${workspaceId}/projects/${projectId}/issues/${issueId}`,
  );
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(
    issuePageUrl(workspaceId, projectId, issueId, {
      success: "issue-updated",
    }),
  );
}

async function addComment(formData: FormData) {
  "use server";

  const workspaceId = String(formData.get("workspaceId") || "");
  const projectId = String(formData.get("projectId") || "");
  const issueId = String(formData.get("issueId") || "");

  if (!workspaceId || !projectId || !issueId) {
    redirect("/dashboard");
  }

  const parsed = commentSchema.safeParse({
    workspaceId,
    projectId,
    issueId,
    body: formData.get("body"),
  });

  if (!parsed.success) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "invalid-comment",
      }),
    );
  }

  const { user } = await requireWorkspaceAccess(workspaceId);

  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      workspaceId,
      projectId,
    },
    include: {
      project: true,
    },
  });

  if (!issue) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "issue-not-found",
      }),
    );
  }

  if (issue.project.archived) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "project-archived",
      }),
    );
  }

  if (issue.archived) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "issue-archived-readonly",
      }),
    );
  }

  const comment = await prisma.comment.create({
    data: {
      workspaceId,
      issueId,
      authorId: user.id,
      body: parsed.data.body,
    },
  });

  await logActivity({
    workspaceId,
    userId: user.id,
    projectId,
    issueId,
    action: "comment.created",
    description: `Commented on issue "${issue.title}".`,
    metadata: {
      commentId: comment.id,
      issueId,
      issueTitle: issue.title,
      projectId,
      projectName: issue.project.name,
    },
  });

  revalidatePath(
    `/dashboard/${workspaceId}/projects/${projectId}/issues/${issueId}`,
  );
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(
    issuePageUrl(workspaceId, projectId, issueId, {
      success: "comment-added",
    }),
  );
}

async function archiveIssue(formData: FormData) {
  "use server";

  const parsed = issueActionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    projectId: formData.get("projectId"),
    issueId: formData.get("issueId"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { workspaceId, projectId, issueId } = parsed.data;

  const { user, membership } = await requireWorkspaceAccess(workspaceId);

  if (!canManageIssue(membership.role)) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "not-authorized",
      }),
    );
  }

  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      workspaceId,
      projectId,
    },
    include: {
      project: true,
    },
  });

  if (!issue) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "issue-not-found",
      }),
    );
  }

  if (issue.project.archived) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "project-archived",
      }),
    );
  }

  if (!issue.archived) {
    await prisma.issue.updateMany({
      where: {
        id: issue.id,
        workspaceId,
        projectId,
      },
      data: {
        archived: true,
      },
    });

    await logActivity({
      workspaceId,
      userId: user.id,
      projectId,
      issueId,
      action: "issue.archived",
      description: `Archived issue "${issue.title}".`,
      metadata: {
        issueId,
        issueTitle: issue.title,
        projectId,
        projectName: issue.project.name,
      },
    });
  }

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/board`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(
    `/dashboard/${workspaceId}/projects/${projectId}/issues/${issueId}`,
  );
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(
    issuePageUrl(workspaceId, projectId, issueId, {
      success: "issue-archived",
    }),
  );
}

async function restoreIssue(formData: FormData) {
  "use server";

  const parsed = issueActionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    projectId: formData.get("projectId"),
    issueId: formData.get("issueId"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { workspaceId, projectId, issueId } = parsed.data;

  const { user, membership } = await requireWorkspaceAccess(workspaceId);

  if (!canManageIssue(membership.role)) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "not-authorized",
      }),
    );
  }

  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      workspaceId,
      projectId,
    },
    include: {
      project: true,
    },
  });

  if (!issue) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "issue-not-found",
      }),
    );
  }

  if (issue.project.archived) {
    redirect(
      issuePageUrl(workspaceId, projectId, issueId, {
        error: "project-archived",
      }),
    );
  }

  if (issue.archived) {
    await prisma.issue.updateMany({
      where: {
        id: issue.id,
        workspaceId,
        projectId,
      },
      data: {
        archived: false,
      },
    });

    await logActivity({
      workspaceId,
      userId: user.id,
      projectId,
      issueId,
      action: "issue.restored",
      description: `Restored issue "${issue.title}".`,
      metadata: {
        issueId,
        issueTitle: issue.title,
        projectId,
        projectName: issue.project.name,
      },
    });
  }

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/board`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(
    `/dashboard/${workspaceId}/projects/${projectId}/issues/${issueId}`,
  );
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(
    issuePageUrl(workspaceId, projectId, issueId, {
      success: "issue-restored",
    }),
  );
}

export default async function IssueDetailPage({
  params,
  searchParams,
}: IssueDetailPageProps) {
  const { workspaceId, projectId, issueId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const errorMessage = getMessage(resolvedSearchParams.error);
  const successMessage = getMessage(resolvedSearchParams.success);

  const { workspace, user, membership } = await requireWorkspaceAccess(
    workspaceId,
  );

  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      workspaceId,
      projectId,
    },
    include: {
      project: true,
      reporter: true,
      assignee: true,
      sprint: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      comments: {
        include: {
          author: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!issue) {
    redirect(
      `/dashboard/${workspaceId}/projects/${projectId}?error=issue-not-found`,
    );
  }

  const workspaceMembers = await prisma.membership.findMany({
    where: {
      workspaceId,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const canEditIssue =
    !issue.project.archived &&
    !issue.archived &&
    (canManageIssue(membership.role) ||
      issue.reporterId === user.id ||
      issue.assigneeId === user.id);

  const canArchiveIssue = canManageIssue(membership.role);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-gray-500">SunGrid</p>
            <h1 className="text-xl font-bold text-gray-900">
              {workspace.name}
            </h1>
          </div>

          <UserButton  />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <DashboardSidebar workspaceId={workspaceId} activePage="projects" />

        <section className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}`}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← Back to project
            </Link>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {issue.project.name}
                </p>

                <h2 className="mt-2 text-3xl font-bold text-gray-900">
                  {issue.title}
                </h2>

                <p className="mt-2 text-gray-600">
                  {issue.description || "No description provided."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {issue.project.archived ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                    Project archived
                  </span>
                ) : null}

                {issue.archived ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                    Issue archived
                  </span>
                ) : (
                  <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                    Active
                  </span>
                )}

                {issue.sprint ? (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                    Sprint: {issue.sprint.name}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                    No sprint
                  </span>
                )}
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {successMessage}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Status</p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                {formatEnum(issue.status)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Priority</p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                {formatEnum(issue.priority)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Type</p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                {formatEnum(issue.type)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Story points</p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                {issue.storyPoints ?? "None"}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Comments</p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                {issue.comments.length}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">
                Ownership
              </h3>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Reporter</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {issue.reporter?.name ||
                      issue.reporter?.email ||
                      "Unknown reporter"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Assignee</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {issue.assignee?.name ||
                      issue.assignee?.email ||
                      "Unassigned"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Sprint</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {issue.sprint
                      ? `${issue.sprint.name} (${formatEnum(issue.sprint.status)})`
                      : "Not assigned to a sprint"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Created</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {issue.createdAt.toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Updated</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {issue.updatedAt.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">
                Issue controls
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                Owners and admins can archive or restore issues. Archived issues
                stay in the database for audit history, but they are hidden from
                active board and sprint planning views.
              </p>

              {canArchiveIssue ? (
                <div className="mt-5">
                  {issue.archived ? (
                    <form action={restoreIssue}>
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspaceId}
                      />
                      <input
                        type="hidden"
                        name="projectId"
                        value={projectId}
                      />
                      <input type="hidden" name="issueId" value={issueId} />

                      <button
                        type="submit"
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Restore issue
                      </button>
                    </form>
                  ) : (
                    <form action={archiveIssue}>
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspaceId}
                      />
                      <input
                        type="hidden"
                        name="projectId"
                        value={projectId}
                      />
                      <input type="hidden" name="issueId" value={issueId} />

                      <button
                        type="submit"
                        className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Archive issue
                      </button>
                    </form>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {canEditIssue ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit issue
              </h3>

              <form action={updateIssue} className="mt-5 space-y-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="issueId" value={issueId} />

                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Issue title
                  </label>

                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    maxLength={120}
                    defaultValue={issue.title}
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description
                  </label>

                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    maxLength={1000}
                    defaultValue={issue.description || ""}
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  <div>
                    <label
                      htmlFor="status"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Status
                    </label>

                    <select
                      id="status"
                      name="status"
                      defaultValue={issue.status}
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                    >
                      {ISSUE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {formatEnum(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="priority"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Priority
                    </label>

                    <select
                      id="priority"
                      name="priority"
                      defaultValue={issue.priority}
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                    >
                      {ISSUE_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {formatEnum(priority)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="type"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Type
                    </label>

                    <select
                      id="type"
                      name="type"
                      defaultValue={issue.type}
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                    >
                      {ISSUE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {formatEnum(type)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="storyPoints"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Points
                    </label>

                    <input
                      id="storyPoints"
                      name="storyPoints"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={issue.storyPoints ?? ""}
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="assigneeId"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Assignee
                    </label>

                    <select
                      id="assigneeId"
                      name="assigneeId"
                      defaultValue={issue.assigneeId || ""}
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="">Unassigned</option>

                      {workspaceMembers.map((member) => (
                        <option key={member.user.id} value={member.user.id}>
                          {member.user.name || member.user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  Save issue
                </button>
              </form>
            </div>
          ) : null}

          {!issue.project.archived && !issue.archived ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">
                Add comment
              </h3>

              <form action={addComment} className="mt-5 space-y-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="issueId" value={issueId} />

                <textarea
                  name="body"
                  rows={3}
                  required
                  maxLength={1000}
                  placeholder="Add an update, technical note, or question."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                />

                <button
                  type="submit"
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  Add comment
                </button>
              </form>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Comments</h3>

              <p className="mt-1 text-sm text-gray-600">
                Workspace discussion for this issue.
              </p>
            </div>

            {issue.comments.length === 0 ? (
              <div className="p-6">
                <p className="text-sm text-gray-600">No comments yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {issue.comments.map((comment) => (
                  <div key={comment.id} className="p-6">
                    <p className="whitespace-pre-wrap text-sm text-gray-900">
                      {comment.body}
                    </p>

                    <p className="mt-3 text-xs text-gray-500">
                      By{" "}
                      {comment.author?.name ||
                        comment.author?.email ||
                        "Unknown user"}{" "}
                      on {comment.createdAt.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
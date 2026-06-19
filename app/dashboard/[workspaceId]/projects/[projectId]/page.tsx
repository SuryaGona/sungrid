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

type ProjectDetailPageProps = {
  params: Promise<{
    workspaceId: string;
    projectId: string;
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

const createIssueSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
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

const issueActionSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  issueId: z.string().min(1),
});

function projectPageUrl(
  workspaceId: string,
  projectId: string,
  params?: Record<string, string>,
) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();

  if (!query) {
    return `/dashboard/${workspaceId}/projects/${projectId}`;
  }

  return `/dashboard/${workspaceId}/projects/${projectId}?${query}`;
}

function getMessage(value: string | undefined) {
  if (!value) {
    return null;
  }

  const messages: Record<string, string> = {
    "invalid-issue":
      "Issue title is required. Check title length, story points, and selected fields.",
    "project-not-found": "Project not found.",
    "project-archived": "Archived projects cannot receive new issues.",
    "assignee-not-member":
      "Selected assignee is not a member of this workspace.",
    "issue-created": "Issue created successfully.",
    "issue-not-found": "Issue not found.",
    "not-authorized": "You are not allowed to perform that action.",
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

function canManageProject(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

function getCompletionRate(totalIssues: number, completedIssues: number) {
  if (totalIssues === 0) {
    return 0;
  }

  return Math.round((completedIssues / totalIssues) * 100);
}

async function createIssue(formData: FormData) {
  "use server";

  const workspaceId = String(formData.get("workspaceId") || "");
  const projectId = String(formData.get("projectId") || "");

  if (!workspaceId || !projectId) {
    redirect("/dashboard");
  }

  const parsed = createIssueSchema.safeParse({
    workspaceId,
    projectId,
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    type: formData.get("type"),
    storyPoints: formData.get("storyPoints"),
    assigneeId: formData.get("assigneeId"),
  });

  if (!parsed.success) {
    redirect(projectPageUrl(workspaceId, projectId, { error: "invalid-issue" }));
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

  const { user } = await requireWorkspaceAccess(workspaceId);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
  });

  if (!project) {
    redirect(
      projectPageUrl(workspaceId, projectId, { error: "project-not-found" }),
    );
  }

  if (project.archived) {
    redirect(
      projectPageUrl(workspaceId, projectId, { error: "project-archived" }),
    );
  }

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
        projectPageUrl(workspaceId, projectId, {
          error: "assignee-not-member",
        }),
      );
    }
  }

  const issueCountInStatus = await prisma.issue.count({
    where: {
      workspaceId,
      projectId,
      status,
      archived: false,
    },
  });

  const issue = await prisma.issue.create({
    data: {
      workspaceId,
      projectId,
      title,
      description: description || null,
      status,
      priority,
      type,
      storyPoints,
      assigneeId: assigneeId || null,
      reporterId: user.id,
      position: issueCountInStatus + 1,
    },
  });

  await logActivity({
    workspaceId,
    userId: user.id,
    projectId,
    issueId: issue.id,
    action: "issue.created",
    description: `Created issue "${issue.title}" in project "${project.name}".`,
    metadata: {
      issueId: issue.id,
      issueTitle: issue.title,
      projectId,
      projectName: project.name,
      status,
      priority,
      type,
      storyPoints,
      assigneeId: assigneeId || null,
    },
  });

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/board`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(projectPageUrl(workspaceId, projectId, { success: "issue-created" }));
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

  if (!canManageProject(membership.role)) {
    redirect(
      projectPageUrl(workspaceId, projectId, { error: "not-authorized" }),
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
    redirect(projectPageUrl(workspaceId, projectId, { error: "issue-not-found" }));
  }

  if (issue.project.archived) {
    redirect(
      projectPageUrl(workspaceId, projectId, { error: "project-archived" }),
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
      issueId: issue.id,
      action: "issue.archived",
      description: `Archived issue "${issue.title}".`,
      metadata: {
        issueId: issue.id,
        issueTitle: issue.title,
        projectId,
        projectName: issue.project.name,
      },
    });
  }

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/board`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(projectPageUrl(workspaceId, projectId, { success: "issue-archived" }));
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

  if (!canManageProject(membership.role)) {
    redirect(
      projectPageUrl(workspaceId, projectId, { error: "not-authorized" }),
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
    redirect(projectPageUrl(workspaceId, projectId, { error: "issue-not-found" }));
  }

  if (issue.project.archived) {
    redirect(
      projectPageUrl(workspaceId, projectId, { error: "project-archived" }),
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
      issueId: issue.id,
      action: "issue.restored",
      description: `Restored issue "${issue.title}".`,
      metadata: {
        issueId: issue.id,
        issueTitle: issue.title,
        projectId,
        projectName: issue.project.name,
      },
    });
  }

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/board`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(projectPageUrl(workspaceId, projectId, { success: "issue-restored" }));
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const { workspaceId, projectId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const errorMessage = getMessage(resolvedSearchParams.error);
  const successMessage = getMessage(resolvedSearchParams.success);

  const { workspace, membership } = await requireWorkspaceAccess(workspaceId);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
  });

  if (!project) {
    redirect(`/dashboard/${workspaceId}/projects?error=project-not-found`);
  }

  const canManageIssues = canManageProject(membership.role);

  const [workspaceMembers, activeIssues, archivedIssues, sprintStats] =
    await Promise.all([
      prisma.membership.findMany({
        where: {
          workspaceId,
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),

      prisma.issue.findMany({
        where: {
          workspaceId,
          projectId,
          archived: false,
        },
        include: {
          assignee: true,
          reporter: true,
          sprint: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: [
          {
            status: "asc",
          },
          {
            position: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
      }),

      prisma.issue.findMany({
        where: {
          workspaceId,
          projectId,
          archived: true,
        },
        include: {
          assignee: true,
          reporter: true,
          sprint: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),

      prisma.sprint.groupBy({
        by: ["status"],
        where: {
          workspaceId,
          projectId,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

  const completedIssues = activeIssues.filter(
    (issue) => issue.status === "DONE",
  ).length;

  const openIssues = Math.max(activeIssues.length - completedIssues, 0);
  const completionRate = getCompletionRate(activeIssues.length, completedIssues);

  const plannedSprints =
    sprintStats.find((item) => item.status === "PLANNED")?._count._all ?? 0;

  const activeSprints =
    sprintStats.find((item) => item.status === "ACTIVE")?._count._all ?? 0;

  const completedSprints =
    sprintStats.find((item) => item.status === "COMPLETED")?._count._all ?? 0;

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
              href={`/dashboard/${workspaceId}/projects`}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← Back to projects
            </Link>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Project workspace
                </p>

                <h2 className="mt-2 text-3xl font-bold text-gray-900">
                  {project.name}
                </h2>

                <p className="mt-2 max-w-2xl text-gray-600">
                  {project.description ||
                    "Manage issues, board flow, sprint planning, and delivery history for this project."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {project.archived ? (
                  <span className="rounded-full bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700">
                    Archived project
                  </span>
                ) : (
                  <span className="rounded-full bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                    Active project
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Active issues</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {activeIssues.length}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {openIssues} open · {completedIssues} done
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Completion</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {completionRate}%
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Active issues only
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Sprints</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {plannedSprints + activeSprints + completedSprints}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {activeSprints} active · {completedSprints} done
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Archived issues</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {archivedIssues.length}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Hidden from board/sprints
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}/board`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-gray-900">Open board</p>
              <p className="mt-2 text-sm text-gray-500">
                Move active issues through Backlog, Todo, Progress, Review, and
                Done.
              </p>
            </Link>

            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}/sprints`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-gray-900">
                Sprint planning
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Plan cycles, assign issues, complete sprints, and view reports.
              </p>
            </Link>

            <Link
              href={`/dashboard/${workspaceId}/analytics`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-gray-900">
                Workspace analytics
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Review completion, sprint performance, and activity metrics.
              </p>
            </Link>
          </div>

          {!project.archived ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">
                Create issue
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                Add a task, bug, feature, or story to this project.
              </p>

              <form action={createIssue} className="mt-5 space-y-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="projectId" value={projectId} />

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
                    placeholder="Build dashboard analytics"
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
                    rows={3}
                    maxLength={1000}
                    placeholder="Add implementation notes, context, or acceptance criteria."
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
                      defaultValue="BACKLOG"
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
                      defaultValue="MEDIUM"
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
                      defaultValue="TASK"
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
                      placeholder="3"
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
                      defaultValue=""
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
                  Create issue
                </button>
              </form>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Active issues
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                Active issues appear on the board, sprint planning, and
                analytics.
              </p>
            </div>

            {activeIssues.length === 0 ? (
              <div className="p-6">
                <p className="text-sm text-gray-500">
                  No active issues yet. Create an issue to start project work.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {activeIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between"
                  >
                    <div>
                      <Link
                        href={`/dashboard/${workspaceId}/projects/${projectId}/issues/${issue.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-gray-600"
                      >
                        {issue.title}
                      </Link>

                      <p className="mt-1 max-w-2xl text-sm text-gray-600">
                        {issue.description || "No description provided."}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {formatEnum(issue.status)}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {formatEnum(issue.priority)}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {formatEnum(issue.type)}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {issue.storyPoints ?? 0} pts
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {issue.assignee?.name ||
                            issue.assignee?.email ||
                            "Unassigned"}
                        </span>

                        {issue.sprint ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                            {issue.sprint.name}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {canManageIssues && !project.archived ? (
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
                        <input type="hidden" name="issueId" value={issue.id} />

                        <button
                          type="submit"
                          className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Archive
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Archived issues
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                Archived issues stay in the database for history, but they are
                hidden from active board and sprint planning.
              </p>
            </div>

            {archivedIssues.length === 0 ? (
              <div className="p-6">
                <p className="text-sm text-gray-500">
                  No archived issues in this project.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {archivedIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between"
                  >
                    <div>
                      <Link
                        href={`/dashboard/${workspaceId}/projects/${projectId}/issues/${issue.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-gray-600"
                      >
                        {issue.title}
                      </Link>

                      <p className="mt-1 max-w-2xl text-sm text-gray-600">
                        {issue.description || "No description provided."}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {formatEnum(issue.status)}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {formatEnum(issue.priority)}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {formatEnum(issue.type)}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {issue.storyPoints ?? 0} pts
                        </span>

                        {issue.sprint ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                            Was in {issue.sprint.name}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {canManageIssues && !project.archived ? (
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
                        <input type="hidden" name="issueId" value={issue.id} />

                        <button
                          type="submit"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Restore
                        </button>
                      </form>
                    ) : null}
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
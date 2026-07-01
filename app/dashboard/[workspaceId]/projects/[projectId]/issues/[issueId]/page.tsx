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

const pageClass = `
  relative min-h-screen overflow-x-hidden bg-[#050505] text-white
  bg-[radial-gradient(circle_at_50%_-10%,rgba(201,162,74,0.1),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(111,78,30,0.08),transparent_28%),#050505]
  before:pointer-events-none before:fixed before:inset-0 before:content-['']
  before:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]
  before:bg-[size:58px_58px]
  before:[mask-image:radial-gradient(circle_at_center,black,transparent_78%)]
`;

const shellClass = `
  relative z-[1] mx-auto grid w-[calc(100vw-56px)] max-w-[1680px]
  grid-cols-[300px_minmax(0,1fr)] gap-6 py-7 pb-6
  max-[1180px]:w-[min(100%,calc(100vw-40px))]
  max-[1180px]:grid-cols-1 max-[1180px]:py-5
  max-[560px]:w-[min(100%,calc(100vw-28px))]
`;

const contentClass = "grid w-full min-w-0 max-w-full gap-4";

const cardClass =
  "rounded-[1.45rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";

const heroCardClass =
  "rounded-[1.45rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";

const sectionHeaderClass =
  "rounded-[1.3rem] border border-white/[0.08] bg-white/[0.025] px-5 py-4 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const statCardClass =
  "rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const miniPanelClass =
  "rounded-[1.25rem] border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]";

const badgeClass =
  "rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-white/55";

const fieldClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d6bf76]/60";

const selectClass =
  "mt-2 w-full cursor-pointer rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-[#d6bf76]/60";

const optionClass = "bg-[#050505] text-white";

const actionButtonClass =
  "rounded-full border px-4 py-2 text-sm font-bold transition hover:-translate-y-px active:translate-y-0 active:scale-[0.98]";

const primaryButtonClass =
  "w-fit rounded-full border border-[#d6bf76]/25 bg-[#d6bf76]/[0.12] px-5 py-2.5 text-sm font-extrabold text-[#f4e7b0] transition hover:-translate-y-px hover:bg-[#d6bf76]/[0.18] hover:text-white active:translate-y-0 active:scale-[0.98]";

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

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
    "invalid-issue":
      "Check the issue title, story points, and selected fields.",
    "invalid-comment":
      "Comment is required and must be 1000 characters or less.",
    "not-authorized": "You are not allowed to perform that action.",
    "assignee-not-member":
      "Selected assignee is not a member of this workspace.",
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

  const { user, membership } = await requireWorkspaceAccess(workspaceId);

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

  const canArchiveIssue =
    canManageIssue(membership.role) && !issue.project.archived;

  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <div className={shellClass}>
        <DashboardSidebar workspaceId={workspaceId} activePage="projects" />

        <section className={contentClass}>
          <header className={heroCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/dashboard/${workspaceId}/projects/${projectId}`}
                className="inline-flex w-fit rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white/55 no-underline transition hover:-translate-y-px hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
              >
                ← Back
              </Link>

              <div className="flex flex-wrap gap-2">
                {issue.project.archived ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-extrabold text-white/55">
                    Project archived
                  </span>
                ) : null}

                {issue.archived ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-extrabold text-white/55">
                    Issue archived
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-extrabold text-emerald-200">
                    Active issue
                  </span>
                )}

                {issue.sprint ? (
                  <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-extrabold text-blue-200">
                    Sprint: {issue.sprint.name}
                  </span>
                ) : (
                  <span className="rounded-full border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] px-3 py-1.5 text-xs font-extrabold text-[#f4e7b0]">
                    No sprint
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                Issue in {issue.project.name}
              </p>

              <h1 className="m-0 mt-3 break-words text-2xl font-extrabold tracking-[-0.04em] text-white md:text-3xl">
                {issue.title}
              </h1>

              <p className="m-0 mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-white/50">
                {issue.description || "No description provided."}
              </p>
            </div>
          </header>

          {errorMessage ? (
            <div className="rounded-[1.35rem] border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-[1.35rem] border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm font-bold text-emerald-100 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
              {successMessage}
            </div>
          ) : null}

          <section className="grid gap-3 md:grid-cols-5">
            <div className={statCardClass}>
              <p className="m-0 text-sm font-bold text-white/45">Status</p>

              <strong className="mt-2 block truncate text-2xl font-extrabold tracking-[-0.04em] text-white">
                {formatEnum(issue.status)}
              </strong>
            </div>

            <div className={statCardClass}>
              <p className="m-0 text-sm font-bold text-white/45">Priority</p>

              <strong className="mt-2 block truncate text-2xl font-extrabold tracking-[-0.04em] text-white">
                {formatEnum(issue.priority)}
              </strong>
            </div>

            <div className={statCardClass}>
              <p className="m-0 text-sm font-bold text-white/45">Type</p>

              <strong className="mt-2 block truncate text-2xl font-extrabold tracking-[-0.04em] text-white">
                {formatEnum(issue.type)}
              </strong>
            </div>

            <div className={statCardClass}>
              <p className="m-0 text-sm font-bold text-white/45">Points</p>

              <strong className="mt-2 block truncate text-2xl font-extrabold tracking-[-0.04em] text-white">
                {issue.storyPoints ?? "None"}
              </strong>
            </div>

            <div className={statCardClass}>
              <p className="m-0 text-sm font-bold text-white/45">Comments</p>

              <strong className="mt-2 block truncate text-2xl font-extrabold tracking-[-0.04em] text-white">
                {issue.comments.length}
              </strong>
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <div className={cardClass}>
              <div className={sectionHeaderClass}>
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                  Ownership
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  Issue details
                </h2>
              </div>

              <div className="mt-3 grid gap-3">
                <div className={miniPanelClass}>
                  <p className="m-0 text-sm font-bold text-white/45">
                    Reporter
                  </p>

                  <p className="m-0 mt-2 break-words text-sm font-bold text-white/70">
                    {issue.reporter?.name ||
                      issue.reporter?.email ||
                      "Unknown reporter"}
                  </p>
                </div>

                <div className={miniPanelClass}>
                  <p className="m-0 text-sm font-bold text-white/45">
                    Assignee
                  </p>

                  <p className="m-0 mt-2 break-words text-sm font-bold text-white/70">
                    {issue.assignee?.name ||
                      issue.assignee?.email ||
                      "Unassigned"}
                  </p>
                </div>

                <div className={miniPanelClass}>
                  <p className="m-0 text-sm font-bold text-white/45">Sprint</p>

                  <p className="m-0 mt-2 break-words text-sm font-bold text-white/70">
                    {issue.sprint
                      ? `${issue.sprint.name} (${formatEnum(issue.sprint.status)})`
                      : "Not assigned to a sprint"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={miniPanelClass}>
                    <p className="m-0 text-sm font-bold text-white/45">
                      Created
                    </p>

                    <p className="m-0 mt-2 text-sm font-bold text-white/70">
                      {issue.createdAt.toLocaleString()}
                    </p>
                  </div>

                  <div className={miniPanelClass}>
                    <p className="m-0 text-sm font-bold text-white/45">
                      Updated
                    </p>

                    <p className="m-0 mt-2 text-sm font-bold text-white/70">
                      {issue.updatedAt.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={cardClass}>
              <div className={sectionHeaderClass}>
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-white/35">
                  Controls
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  Issue controls
                </h2>
              </div>

              <p className="m-0 mt-3 text-sm leading-6 text-white/45">
                Owners and admins can archive or restore issues. Archived issues
                stay available for audit history.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={badgeClass}>{formatEnum(issue.status)}</span>
                <span className={badgeClass}>
                  {formatEnum(issue.priority)}
                </span>
                <span className={badgeClass}>{formatEnum(issue.type)}</span>
                <span className={badgeClass}>{issue.storyPoints ?? 0} pts</span>
              </div>

              {canArchiveIssue ? (
                <div className="mt-5">
                  {issue.archived ? (
                    <form action={restoreIssue}>
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspaceId}
                      />

                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="issueId" value={issueId} />

                      <button
                        type="submit"
                        className={`${actionButtonClass} border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100`}
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

                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="issueId" value={issueId} />

                      <button
                        type="submit"
                        className={`${actionButtonClass} border-red-400/20 text-red-200 hover:bg-red-400/10`}
                      >
                        Archive issue
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <p className="m-0 mt-5 text-sm text-white/35">
                  Only owners and admins can archive or restore issues.
                </p>
              )}
            </div>
          </section>

          {canEditIssue ? (
            <section className={cardClass}>
              <div className={sectionHeaderClass}>
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                  Edit issue
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  Update issue
                </h2>
              </div>

              <form action={updateIssue} className="mt-4 grid gap-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="issueId" value={issueId} />

                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-bold text-white/70"
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
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-bold text-white/70"
                  >
                    Description
                  </label>

                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    maxLength={1000}
                    defaultValue={issue.description || ""}
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-5">
                  <div>
                    <label
                      htmlFor="status"
                      className="block text-sm font-bold text-white/70"
                    >
                      Status
                    </label>

                    <select
                      id="status"
                      name="status"
                      defaultValue={issue.status}
                      className={selectClass}
                      style={{ colorScheme: "dark" }}
                    >
                      {ISSUE_STATUSES.map((status) => (
                        <option
                          key={status}
                          value={status}
                          className={optionClass}
                        >
                          {formatEnum(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="priority"
                      className="block text-sm font-bold text-white/70"
                    >
                      Priority
                    </label>

                    <select
                      id="priority"
                      name="priority"
                      defaultValue={issue.priority}
                      className={selectClass}
                      style={{ colorScheme: "dark" }}
                    >
                      {ISSUE_PRIORITIES.map((priority) => (
                        <option
                          key={priority}
                          value={priority}
                          className={optionClass}
                        >
                          {formatEnum(priority)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="type"
                      className="block text-sm font-bold text-white/70"
                    >
                      Type
                    </label>

                    <select
                      id="type"
                      name="type"
                      defaultValue={issue.type}
                      className={selectClass}
                      style={{ colorScheme: "dark" }}
                    >
                      {ISSUE_TYPES.map((type) => (
                        <option key={type} value={type} className={optionClass}>
                          {formatEnum(type)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="storyPoints"
                      className="block text-sm font-bold text-white/70"
                    >
                      Points
                    </label>

                    <input
                      id="storyPoints"
                      name="storyPoints"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      defaultValue={issue.storyPoints ?? ""}
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="assigneeId"
                      className="block text-sm font-bold text-white/70"
                    >
                      Assignee
                    </label>

                    <select
                      id="assigneeId"
                      name="assigneeId"
                      defaultValue={issue.assigneeId || ""}
                      className={selectClass}
                      style={{ colorScheme: "dark" }}
                    >
                      <option value="" className={optionClass}>
                        Unassigned
                      </option>

                      {workspaceMembers.map((member) => (
                        <option
                          key={member.user.id}
                          value={member.user.id}
                          className={optionClass}
                        >
                          {member.user.name || member.user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="submit" className={primaryButtonClass}>
                  Save issue
                </button>
              </form>
            </section>
          ) : null}

          {!issue.project.archived && !issue.archived ? (
            <section className={cardClass}>
              <div className={sectionHeaderClass}>
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-white/35">
                  New comment
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  Add comment
                </h2>
              </div>

              <form action={addComment} className="mt-4 grid gap-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="issueId" value={issueId} />

                <textarea
                  name="body"
                  rows={3}
                  required
                  maxLength={1000}
                  placeholder="Add an update, technical note, or question."
                  className={`${fieldClass} resize-none`}
                />

                <button type="submit" className={primaryButtonClass}>
                  Add comment
                </button>
              </form>
            </section>
          ) : null}

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <div>
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-white/35">
                  Discussion
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  {issue.comments.length} comments
                </h2>
              </div>
            </div>

            {issue.comments.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-black/25 p-5 text-sm text-white/45 shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
                No comments yet.
              </div>
            ) : (
              <div className="grid gap-3">
                {issue.comments.map((comment) => (
                  <article
                    key={comment.id}
                    className="rounded-[1.35rem] border border-white/[0.08] bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_14px_36px_rgba(0,0,0,0.14)]"
                  >
                    <p className="m-0 whitespace-pre-wrap text-sm leading-6 text-white/80">
                      {comment.body}
                    </p>

                    <p className="m-0 mt-3 text-xs font-bold text-white/35">
                      By{" "}
                      {comment.author?.name ||
                        comment.author?.email ||
                        "Unknown user"}{" "}
                      on {comment.createdAt.toLocaleString()}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

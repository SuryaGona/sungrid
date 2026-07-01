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

const metricCardClass =
  "rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const actionLinkClass =
  "rounded-[1.25rem] border border-white/10 bg-black/30 p-4 no-underline shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition hover:-translate-y-px hover:border-[#d6bf76]/15 hover:bg-white/[0.035] active:translate-y-0 active:scale-[0.99]";

const issueCardClass =
  "group relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_14px_36px_rgba(0,0,0,0.16)] transition hover:-translate-y-px hover:border-[#d6bf76]/15 hover:bg-white/[0.035]";

const archivedIssueCardClass =
  "relative overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-black/25 p-4 opacity-80 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_14px_36px_rgba(0,0,0,0.14)] transition hover:border-white/[0.12] hover:bg-white/[0.025]";

const badgeClass =
  "rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-white/55";

const actionButtonClass =
  "rounded-full border px-4 py-2 text-sm font-bold transition hover:-translate-y-px active:translate-y-0 active:scale-[0.98]";

const createButtonClass =
  "w-fit rounded-full border border-[#d6bf76]/25 bg-[#d6bf76]/[0.12] px-5 py-2.5 text-sm font-extrabold text-[#f4e7b0] transition hover:-translate-y-px hover:bg-[#d6bf76]/[0.18] hover:text-white active:translate-y-0 active:scale-[0.98]";

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

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

function CreateIssueForm({
  workspaceId,
  projectId,
  workspaceMembers,
  compact = false,
}: {
  workspaceId: string;
  projectId: string;
  workspaceMembers: Array<{
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
  compact?: boolean;
}) {
  const fieldClass =
    "mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d6bf76]/60";

  const selectClass =
    "mt-2 w-full cursor-pointer rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-[#d6bf76]/60";

  const optionClass = "bg-[#050505] text-white";

  return (
    <form action={createIssue} className="grid gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="projectId" value={projectId} />

      <div>
        <label
          htmlFor={compact ? "compact-title" : "title"}
          className="block text-sm font-bold text-white/70"
        >
          Issue title
        </label>

        <input
          id={compact ? "compact-title" : "title"}
          name="title"
          type="text"
          required
          maxLength={120}
          placeholder="Example: Build dashboard analytics"
          className={fieldClass}
        />
      </div>

      <div>
        <label
          htmlFor={compact ? "compact-description" : "description"}
          className="block text-sm font-bold text-white/70"
        >
          Description
        </label>

        <textarea
          id={compact ? "compact-description" : "description"}
          name="description"
          rows={compact ? 2 : 3}
          maxLength={1000}
          placeholder="Add implementation notes, context, or acceptance criteria."
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div>
          <label
            htmlFor={compact ? "compact-status" : "status"}
            className="block text-sm font-bold text-white/70"
          >
            Status
          </label>

          <select
            id={compact ? "compact-status" : "status"}
            name="status"
            defaultValue="BACKLOG"
            className={selectClass}
            style={{ colorScheme: "dark" }}
          >
            {ISSUE_STATUSES.map((status) => (
              <option key={status} value={status} className={optionClass}>
                {formatEnum(status)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={compact ? "compact-priority" : "priority"}
            className="block text-sm font-bold text-white/70"
          >
            Priority
          </label>

          <select
            id={compact ? "compact-priority" : "priority"}
            name="priority"
            defaultValue="MEDIUM"
            className={selectClass}
            style={{ colorScheme: "dark" }}
          >
            {ISSUE_PRIORITIES.map((priority) => (
              <option key={priority} value={priority} className={optionClass}>
                {formatEnum(priority)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={compact ? "compact-type" : "type"}
            className="block text-sm font-bold text-white/70"
          >
            Type
          </label>

          <select
            id={compact ? "compact-type" : "type"}
            name="type"
            defaultValue="TASK"
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
            htmlFor={compact ? "compact-storyPoints" : "storyPoints"}
            className="block text-sm font-bold text-white/70"
          >
            Points
          </label>

          <input
            id={compact ? "compact-storyPoints" : "storyPoints"}
            name="storyPoints"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="3"
            className={fieldClass}
          />
        </div>

        <div>
          <label
            htmlFor={compact ? "compact-assigneeId" : "assigneeId"}
            className="block text-sm font-bold text-white/70"
          >
            Assignee
          </label>

          <select
            id={compact ? "compact-assigneeId" : "assigneeId"}
            name="assigneeId"
            defaultValue=""
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

      <button type="submit" className={createButtonClass}>
        Create issue
      </button>
    </form>
  );
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const { workspaceId, projectId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const errorMessage = getMessage(resolvedSearchParams.error);
  const successMessage = getMessage(resolvedSearchParams.success);

  const { membership } = await requireWorkspaceAccess(workspaceId);

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

  const totalSprints = plannedSprints + activeSprints + completedSprints;

  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <div className={shellClass}>
        <DashboardSidebar workspaceId={workspaceId} activePage="projects" />

        <section className={contentClass}>
          <header className={heroCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/dashboard/${workspaceId}/projects`}
                className="inline-flex w-fit rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white/55 no-underline transition hover:-translate-y-px hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
              >
                ← Back
              </Link>

              {project.archived ? (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-extrabold text-white/55">
                  Archived project
                </span>
              ) : (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-extrabold text-emerald-200">
                  Active project
                </span>
              )}
            </div>

            <div className="mt-5">
              <h1 className="m-0 text-2xl font-extrabold tracking-[-0.04em] text-white md:text-3xl">
                Project: {project.name}
              </h1>

              <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-white/50">
                {project.description ||
                  "Manage issues, board flow, sprint planning, and delivery history."}
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

          <section className="grid gap-3 md:grid-cols-4">
            <div className={metricCardClass}>
              <p className="m-0 text-sm font-bold text-white/45">
                Active issues
              </p>

              <strong className="mt-2 block text-2xl font-extrabold tracking-[-0.04em] text-white">
                {activeIssues.length}
              </strong>

              <span className="mt-1.5 block text-xs text-white/35">
                {openIssues} open · {completedIssues} done
              </span>
            </div>

            <div className={metricCardClass}>
              <p className="m-0 text-sm font-bold text-white/45">Completion</p>

              <strong className="mt-2 block text-2xl font-extrabold tracking-[-0.04em] text-white">
                {completionRate}%
              </strong>

              <span className="mt-1.5 block text-xs text-white/35">
                Active issues only
              </span>
            </div>

            <div className={metricCardClass}>
              <p className="m-0 text-sm font-bold text-white/45">Sprints</p>

              <strong className="mt-2 block text-2xl font-extrabold tracking-[-0.04em] text-white">
                {totalSprints}
              </strong>

              <span className="mt-1.5 block text-xs text-white/35">
                {activeSprints} active · {completedSprints} done
              </span>
            </div>

            <div className={metricCardClass}>
              <p className="m-0 text-sm font-bold text-white/45">
                Archived issues
              </p>

              <strong className="mt-2 block text-2xl font-extrabold tracking-[-0.04em] text-white">
                {archivedIssues.length}
              </strong>

              <span className="mt-1.5 block text-xs text-white/35">
                Hidden from active work
              </span>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}/board`}
              className={actionLinkClass}
            >
              <p className="m-0 text-base font-extrabold text-white">
                Open board
              </p>

              <p className="m-0 mt-1.5 line-clamp-2 text-sm leading-6 text-white/45">
                Move active issues through each project status.
              </p>
            </Link>

            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}/sprints`}
              className={actionLinkClass}
            >
              <p className="m-0 text-base font-extrabold text-white">
                Sprint planning
              </p>

              <p className="m-0 mt-1.5 line-clamp-2 text-sm leading-6 text-white/45">
                Plan cycles, assign issues, and complete sprints.
              </p>
            </Link>

            <Link
              href={`/dashboard/${workspaceId}/analytics`}
              className={actionLinkClass}
            >
              <p className="m-0 text-base font-extrabold text-white">
                Analytics
              </p>

              <p className="m-0 mt-1.5 line-clamp-2 text-sm leading-6 text-white/45">
                Review completion, sprint performance, and activity.
              </p>
            </Link>
          </section>

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <div>
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                  Active issues
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  {activeIssues.length} active
                </h2>
              </div>
            </div>

            {activeIssues.length === 0 ? (
              <div className={cardClass}>
                <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-black/25 p-5">
                  <div className="max-w-2xl">
                    <h3 className="m-0 text-lg font-extrabold text-white">
                      No active issues yet
                    </h3>

                    <p className="m-0 mt-2 text-sm leading-6 text-white/45">
                      Create your first issue to start tracking project work.
                    </p>
                  </div>

                  {!project.archived ? (
                    <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-black/25 p-5">
                      <CreateIssueForm
                        workspaceId={workspaceId}
                        projectId={projectId}
                        workspaceMembers={workspaceMembers}
                      />
                    </div>
                  ) : (
                    <p className="m-0 mt-5 text-sm text-white/45">
                      Archived projects cannot receive new issues.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {activeIssues.map((issue) => (
                  <article key={issue.id} className={issueCardClass}>
                    <div className="pointer-events-none absolute -right-20 -top-20 h-36 w-36 rounded-full bg-[#d6bf76]/[0.02] blur-3xl transition group-hover:bg-[#d6bf76]/[0.035]" />

                    <div className="relative">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/${workspaceId}/projects/${projectId}/issues/${issue.id}`}
                            className="text-base font-extrabold text-white no-underline transition hover:text-[#f4e7b0]"
                          >
                            {issue.title}
                          </Link>

                          <p className="m-0 mt-1.5 line-clamp-1 max-w-3xl text-sm leading-6 text-white/45">
                            {issue.description || "No description provided."}
                          </p>
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

                            <input
                              type="hidden"
                              name="issueId"
                              value={issue.id}
                            />

                            <button
                              type="submit"
                              className={`${actionButtonClass} border-red-400/20 text-red-200 hover:bg-red-400/10`}
                            >
                              Archive
                            </button>
                          </form>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={badgeClass}>
                          {formatEnum(issue.status)}
                        </span>

                        <span className={badgeClass}>
                          {formatEnum(issue.priority)}
                        </span>

                        <span className={badgeClass}>
                          {formatEnum(issue.type)}
                        </span>

                        <span className={badgeClass}>
                          {issue.storyPoints ?? 0} pts
                        </span>

                        <span className={badgeClass}>
                          {issue.assignee?.name ||
                            issue.assignee?.email ||
                            "Unassigned"}
                        </span>

                        {issue.sprint ? (
                          <span className={badgeClass}>
                            {issue.sprint.name}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {!project.archived && activeIssues.length > 0 ? (
            <section id="create-issue" className={cardClass}>
              <div className="mb-5">
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-white/35">
                  New issue
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  Create issue
                </h2>

                <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-white/45">
                  Add another task, bug, feature, or story to this project.
                </p>
              </div>

              <CreateIssueForm
                workspaceId={workspaceId}
                projectId={projectId}
                workspaceMembers={workspaceMembers}
                compact
              />
            </section>
          ) : null}

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <div>
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-white/35">
                  Archived issues
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  {archivedIssues.length} archived
                </h2>
              </div>
            </div>

            {archivedIssues.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-black/25 p-5 text-sm text-white/45 shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
                No archived issues in this project.
              </div>
            ) : (
              <div className="grid gap-3">
                {archivedIssues.map((issue) => (
                  <article key={issue.id} className={archivedIssueCardClass}>
                    <div className="pointer-events-none absolute -right-20 -top-20 h-36 w-36 rounded-full bg-white/[0.012] blur-3xl" />

                    <div className="relative">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/${workspaceId}/projects/${projectId}/issues/${issue.id}`}
                            className="text-base font-extrabold text-white/85 no-underline transition hover:text-[#f4e7b0]"
                          >
                            {issue.title}
                          </Link>

                          <p className="m-0 mt-1.5 line-clamp-1 max-w-3xl text-sm leading-6 text-white/38">
                            {issue.description || "No description provided."}
                          </p>
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

                            <input
                              type="hidden"
                              name="issueId"
                              value={issue.id}
                            />

                            <button
                              type="submit"
                              className={`${actionButtonClass} border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100`}
                            >
                              Restore
                            </button>
                          </form>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={badgeClass}>
                          {formatEnum(issue.status)}
                        </span>

                        <span className={badgeClass}>
                          {formatEnum(issue.priority)}
                        </span>

                        <span className={badgeClass}>
                          {formatEnum(issue.type)}
                        </span>

                        <span className={badgeClass}>
                          {issue.storyPoints ?? 0} pts
                        </span>

                        {issue.sprint ? (
                          <span className={badgeClass}>
                            Was in {issue.sprint.name}
                          </span>
                        ) : null}
                      </div>
                    </div>
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

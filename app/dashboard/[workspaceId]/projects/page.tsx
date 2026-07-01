import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import {
  requireWorkspaceAccess,
  requireWorkspaceRole,
} from "@/lib/workspace-auth";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProjectsPageProps = {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

const ISSUE_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
] as const;

type IssueStatus = (typeof ISSUE_STATUSES)[number];

const createProjectSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1, "Project name is required.").max(80),
  description: z.string().trim().max(500).optional(),
});

const projectActionSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
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
  "rounded-[1.65rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.24)]";

const sectionHeaderClass =
  "rounded-[1.35rem] border border-white/[0.08] bg-white/[0.025] px-5 py-4 shadow-[0_16px_42px_rgba(0,0,0,0.18)]";

const projectCardClass =
  "group relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_16px_42px_rgba(0,0,0,0.18)] transition hover:-translate-y-px hover:border-[#d6bf76]/15 hover:bg-white/[0.035]";

const archivedProjectCardClass =
  "relative overflow-hidden rounded-[1.45rem] border border-white/[0.08] bg-black/25 p-4 opacity-80 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_14px_36px_rgba(0,0,0,0.14)] transition hover:border-white/[0.12] hover:bg-white/[0.025]";

function BackgroundGlows() {
  return (
    <>
      <div
        className="
          pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px]
          rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]
        "
      />

      <div
        className="
          pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px]
          rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]
        "
      />
    </>
  );
}

function projectsPageUrl(
  workspaceId: string,
  params?: {
    success?: string;
    error?: string;
  },
) {
  const searchParams = new URLSearchParams();

  if (params?.success) {
    searchParams.set("success", params.success);
  }

  if (params?.error) {
    searchParams.set("error", params.error);
  }

  const query = searchParams.toString();

  return query
    ? `/dashboard/${workspaceId}/projects?${query}`
    : `/dashboard/${workspaceId}/projects`;
}

function getSuccessMessage(success?: string) {
  switch (success) {
    case "project-created":
      return "Project created.";
    case "project-archived":
      return "Project archived.";
    case "project-restored":
      return "Project restored.";
    default:
      return null;
  }
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "project-name-required":
      return "Project name is required.";
    case "project-not-found":
      return "Project was not found in this workspace.";
    case "not-allowed":
      return "You do not have permission to manage projects.";
    case "database":
      return "SunGrid could not complete that project action.";
    default:
      return null;
  }
}

function formatStatusLabel(status: IssueStatus) {
  switch (status) {
    case "BACKLOG":
      return "Backlog";
    case "TODO":
      return "Todo";
    case "IN_PROGRESS":
      return "Progress";
    case "REVIEW":
      return "Review";
    case "DONE":
      return "Done";
    default:
      return status;
  }
}

function getIssueProgress(
  issues: {
    status: IssueStatus;
    archived: boolean;
  }[],
) {
  const activeIssues = issues.filter((issue) => !issue.archived);
  const archivedIssues = issues.filter((issue) => issue.archived);

  const counts = ISSUE_STATUSES.reduce<Record<IssueStatus, number>>(
    (acc, status) => {
      acc[status] = activeIssues.filter(
        (issue) => issue.status === status,
      ).length;

      return acc;
    },
    {
      BACKLOG: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      REVIEW: 0,
      DONE: 0,
    },
  );

  const totalActive = activeIssues.length;
  const done = counts.DONE;
  const open = Math.max(totalActive - done, 0);
  const completion =
    totalActive === 0 ? 0 : Math.round((done / totalActive) * 100);

  return {
    counts,
    totalActive,
    archivedCount: archivedIssues.length,
    done,
    open,
    completion,
  };
}

function IssueProgressPanel({
  issues,
}: {
  issues: {
    status: IssueStatus;
    archived: boolean;
  }[];
}) {
  const progress = getIssueProgress(issues);

  return (
    <div className="mt-3 rounded-[1.15rem] border border-white/[0.08] bg-white/[0.025] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#d6bf76]/90">
            Issue progress
          </p>

          <p className="m-0 mt-1 text-xs font-bold text-white/40">
            {progress.totalActive} active • {progress.open} open •{" "}
            {progress.done} done
          </p>
        </div>

        <div className="rounded-full border border-white/[0.08] bg-black/30 px-2.5 py-1 text-xs font-extrabold text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          {progress.completion}%
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5 max-[820px]:grid-cols-5 max-[640px]:grid-cols-2">
        {ISSUE_STATUSES.map((status) => {
          const isDone = status === "DONE";

          return (
            <div
              key={status}
              className={
                isDone
                  ? "min-w-0 overflow-hidden rounded-[0.95rem] border border-emerald-400/15 bg-emerald-400/[0.07] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  : "min-w-0 overflow-hidden rounded-[0.95rem] border border-white/[0.08] bg-black/25 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              }
            >
              <p className="m-0 truncate text-[9px] font-extrabold uppercase tracking-[0.07em] text-white/30">
                {formatStatusLabel(status)}
              </p>

              <p
                className={
                  isDone
                    ? "m-0 mt-1 text-sm font-extrabold text-emerald-200"
                    : "m-0 mt-1 text-sm font-extrabold text-white/90"
                }
              >
                {progress.counts[status]}
              </p>
            </div>
          );
        })}
      </div>

      {progress.archivedCount > 0 ? (
        <p className="m-0 mt-2.5 text-xs font-bold text-white/30">
          {progress.archivedCount} archived issue
          {progress.archivedCount === 1 ? "" : "s"} hidden from active progress.
        </p>
      ) : null}
    </div>
  );
}

async function createProject(formData: FormData) {
  "use server";

  const parsed = createProjectSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const workspaceId = String(formData.get("workspaceId") || "");

    if (workspaceId) {
      redirect(projectsPageUrl(workspaceId, { error: "project-name-required" }));
    }

    redirect("/dashboard");
  }

  const { workspaceId, name, description } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN"]);

  let projectId: string | null = null;

  try {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name,
        description: description || null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    projectId = project.id;

    await logActivity({
      workspaceId,
      userId: user.id,
      projectId: project.id,
      action: "project.created",
      description: `Created project "${project.name}".`,
      metadata: {
        projectId: project.id,
        projectName: project.name,
      },
    });
  } catch (error) {
    console.error("Create project failed:", error);
    redirect(projectsPageUrl(workspaceId, { error: "database" }));
  }

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  if (!projectId) {
    redirect(projectsPageUrl(workspaceId, { error: "database" }));
  }

  redirect(projectsPageUrl(workspaceId, { success: "project-created" }));
}

async function archiveProject(formData: FormData) {
  "use server";

  const parsed = projectActionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    projectId: formData.get("projectId"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { workspaceId, projectId } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN"]);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
    select: {
      id: true,
      name: true,
      archived: true,
    },
  });

  if (!project) {
    redirect(projectsPageUrl(workspaceId, { error: "project-not-found" }));
  }

  if (!project.archived) {
    await prisma.project.updateMany({
      where: {
        id: project.id,
        workspaceId,
      },
      data: {
        archived: true,
      },
    });

    await logActivity({
      workspaceId,
      userId: user.id,
      projectId: project.id,
      action: "project.archived",
      description: `Archived project "${project.name}".`,
      metadata: {
        projectId: project.id,
        projectName: project.name,
      },
    });
  }

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${project.id}`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(projectsPageUrl(workspaceId, { success: "project-archived" }));
}

async function restoreProject(formData: FormData) {
  "use server";

  const parsed = projectActionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    projectId: formData.get("projectId"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { workspaceId, projectId } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN"]);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
    select: {
      id: true,
      name: true,
      archived: true,
    },
  });

  if (!project) {
    redirect(projectsPageUrl(workspaceId, { error: "project-not-found" }));
  }

  if (project.archived) {
    await prisma.project.updateMany({
      where: {
        id: project.id,
        workspaceId,
      },
      data: {
        archived: false,
      },
    });

    await logActivity({
      workspaceId,
      userId: user.id,
      projectId: project.id,
      action: "project.restored",
      description: `Restored project "${project.name}".`,
      metadata: {
        projectId: project.id,
        projectName: project.name,
      },
    });
  }

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${project.id}`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(projectsPageUrl(workspaceId, { success: "project-restored" }));
}

function CreateProjectForm({
  workspaceId,
  compact = false,
}: {
  workspaceId: string;
  compact?: boolean;
}) {
  return (
    <form action={createProject} className="grid gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <div>
        <label
          htmlFor={compact ? "compact-project-name" : "project-name"}
          className="block text-sm font-bold text-white/70"
        >
          Project name
        </label>

        <input
          id={compact ? "compact-project-name" : "project-name"}
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder="Example: Website Redesign"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d6bf76]/60"
        />
      </div>

      <div>
        <label
          htmlFor={
            compact ? "compact-project-description" : "project-description"
          }
          className="block text-sm font-bold text-white/70"
        >
          Description
        </label>

        <textarea
          id={compact ? "compact-project-description" : "project-description"}
          name="description"
          rows={compact ? 2 : 3}
          maxLength={500}
          placeholder="What is this project about?"
          className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d6bf76]/60"
        />
      </div>

      <button
        type="submit"
        className="w-fit rounded-full border border-[#d6bf76]/25 bg-[#d6bf76]/[0.12] px-5 py-2.5 text-sm font-extrabold text-[#f4e7b0] transition hover:-translate-y-0.5 hover:bg-[#d6bf76]/[0.18] hover:text-white active:translate-y-0 active:scale-[0.98]"
      >
        Create project
      </button>
    </form>
  );
}

export default async function ProjectsPage({
  params,
  searchParams,
}: ProjectsPageProps) {
  const { workspaceId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const successMessage = getSuccessMessage(resolvedSearchParams.success);
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  const { workspace, membership } = await requireWorkspaceAccess(workspaceId);

  const canManageProjects =
    membership.role === "OWNER" || membership.role === "ADMIN";

  const projects = await prisma.project.findMany({
    where: {
      workspaceId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      issues: {
        select: {
          status: true,
          archived: true,
        },
      },
      _count: {
        select: {
          issues: true,
          sprints: true,
        },
      },
    },
  });

  const activeProjects = projects.filter((project) => !project.archived);
  const archivedProjects = projects.filter((project) => project.archived);

  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <div className={shellClass}>
        <DashboardSidebar workspaceId={workspaceId} activePage="projects" />

        <section className={contentClass}>
          <header className={cardClass}>
            <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
              Projects
            </p>

            <h1 className="m-0 mt-3 text-3xl font-extrabold tracking-[-0.04em] text-white md:text-4xl">
              {workspace.name} projects
            </h1>

            <p className="m-0 mt-3 max-w-2xl text-sm leading-6 text-white/50">
              Organize your workspace into focused projects, track issues, and
              keep delivery moving.
            </p>
          </header>

          {successMessage ? (
            <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm font-bold text-emerald-100 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              {successMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-[1.5rem] border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              {errorMessage}
            </div>
          ) : null}

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <div>
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                  Active projects
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  {activeProjects.length} active
                </h2>
              </div>
            </div>

            {activeProjects.length === 0 ? (
              <div className={cardClass}>
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/25 p-5">
                  <div className="max-w-2xl">
                    <h3 className="m-0 text-lg font-extrabold text-white">
                      No active projects yet
                    </h3>

                    <p className="m-0 mt-2 text-sm leading-6 text-white/45">
                      Create your first project to start organizing issues,
                      boards, and sprint work inside this workspace.
                    </p>
                  </div>

                  {canManageProjects ? (
                    <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
                      <CreateProjectForm workspaceId={workspaceId} />
                    </div>
                  ) : (
                    <p className="m-0 mt-5 text-sm text-white/45">
                      Only owners and admins can create projects.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {activeProjects.map((project) => (
                  <article key={project.id} className={projectCardClass}>
                    <div className="pointer-events-none absolute -right-20 -top-20 h-36 w-36 rounded-full bg-[#d6bf76]/[0.02] blur-3xl transition group-hover:bg-[#d6bf76]/[0.035]" />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-4 max-[640px]:flex-col">
                        <div className="min-w-0">
                          <h3 className="m-0 truncate text-lg font-extrabold text-white">
                            {project.name}
                          </h3>

                          <p className="mt-1.5 line-clamp-1 text-sm leading-6 text-white/45">
                            {project.description || "No description yet."}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-extrabold text-emerald-200">
                          Active
                        </span>
                      </div>

                      <IssueProgressPanel issues={project.issues} />

                      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-3 text-sm text-white/40">
                          <span>{project._count.issues} total issues</span>
                          <span>•</span>
                          <span>{project._count.sprints} sprints</span>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                          <Link
                            href={`/dashboard/${workspaceId}/projects/${project.id}`}
                            className="rounded-full border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] px-4 py-2 text-sm font-extrabold text-[#f4e7b0] no-underline transition hover:-translate-y-px hover:bg-[#d6bf76]/[0.14] hover:text-white active:translate-y-0 active:scale-[0.98]"
                          >
                            Open project
                          </Link>

                          <Link
                            href={`/dashboard/${workspaceId}/projects/${project.id}/board`}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white/65 no-underline transition hover:-translate-y-px hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
                          >
                            Open board
                          </Link>

                          {canManageProjects ? (
                            <form action={archiveProject}>
                              <input
                                type="hidden"
                                name="workspaceId"
                                value={workspaceId}
                              />

                              <input
                                type="hidden"
                                name="projectId"
                                value={project.id}
                              />

                              <button
                                type="submit"
                                className="rounded-full border border-red-400/20 px-4 py-2 text-sm font-bold text-red-200 transition hover:-translate-y-px hover:bg-red-400/10 active:translate-y-0 active:scale-[0.98]"
                              >
                                Archive
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {canManageProjects && activeProjects.length > 0 ? (
            <section id="create-project" className={cardClass}>
              <div className="mb-5">
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-white/35">
                  New project
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  Create project
                </h2>

                <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-white/45">
                  Add another project when your workspace has a new area of work
                  to track.
                </p>
              </div>

              <CreateProjectForm workspaceId={workspaceId} compact />
            </section>
          ) : null}

          {!canManageProjects ? (
            <section className={cardClass}>
              <h2 className="m-0 text-lg font-extrabold text-white">
                Project access
              </h2>

              <p className="m-0 mt-2 text-sm leading-6 text-white/50">
                You can view projects, but only owners and admins can create,
                archive, or restore projects.
              </p>
            </section>
          ) : null}

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <div>
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.22em] text-white/35">
                  Archived projects
                </p>

                <h2 className="m-0 mt-2 text-xl font-extrabold text-white">
                  {archivedProjects.length} archived
                </h2>
              </div>
            </div>

            {archivedProjects.length === 0 ? (
              <div className="rounded-[1.45rem] border border-dashed border-white/10 bg-black/25 p-5 text-sm text-white/45 shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
                No archived projects.
              </div>
            ) : (
              <div className="grid gap-3">
                {archivedProjects.map((project) => (
                  <article
                    key={project.id}
                    className={archivedProjectCardClass}
                  >
                    <div className="pointer-events-none absolute -right-20 -top-20 h-36 w-36 rounded-full bg-white/[0.012] blur-3xl" />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-4 max-[640px]:flex-col">
                        <div className="min-w-0">
                          <h3 className="m-0 truncate text-lg font-extrabold text-white/85">
                            {project.name}
                          </h3>

                          <p className="mt-1.5 line-clamp-1 text-sm leading-6 text-white/38">
                            {project.description || "No description yet."}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-extrabold text-white/40">
                          Archived
                        </span>
                      </div>

                      <IssueProgressPanel issues={project.issues} />

                      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-3 text-sm text-white/35">
                          <span>{project._count.issues} total issues</span>
                          <span>•</span>
                          <span>{project._count.sprints} sprints</span>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                          <Link
                            href={`/dashboard/${workspaceId}/projects/${project.id}`}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white/55 no-underline transition hover:bg-white/5 hover:text-white"
                          >
                            View project
                          </Link>

                          {canManageProjects ? (
                            <form action={restoreProject}>
                              <input
                                type="hidden"
                                name="workspaceId"
                                value={workspaceId}
                              />

                              <input
                                type="hidden"
                                name="projectId"
                                value={project.id}
                              />

                              <button
                                type="submit"
                                className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/10 hover:text-emerald-100"
                              >
                                Restore
                              </button>
                            </form>
                          ) : null}
                        </div>
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

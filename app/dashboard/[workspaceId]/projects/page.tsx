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
import layoutStyles from "../workspace-dashboard.module.css";

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

const cardClass =
  "rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]";

const projectCardClass =
  "group relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_55px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-amber-300/20 hover:bg-white/[0.045]";

const archivedProjectCardClass =
  "relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 p-5 opacity-75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_55px_rgba(0,0,0,0.18)]";

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
    <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300/80">
            Issue progress
          </p>

          <p className="mt-1 text-sm font-bold text-white/55">
            {progress.totalActive} active • {progress.open} open •{" "}
            {progress.done} done
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {progress.completion}%
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full border border-white/10 bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-emerald-300 shadow-[0_0_28px_rgba(251,191,36,0.25)] transition-all duration-700 ease-out"
          style={{
            width: `${progress.completion}%`,
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {ISSUE_STATUSES.map((status) => {
          const isDone = status === "DONE";

          return (
            <div
              key={status}
              className={
                isDone
                  ? "min-w-0 overflow-hidden border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]"
                  : "min-w-0 overflow-hidden border border-white/10 bg-black/30 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              }
              style={{
                borderRadius: "1.35rem",
              }}
            >
              <p className="truncate text-[10px] font-black uppercase tracking-[0.08em] text-white/35">
                {formatStatusLabel(status)}
              </p>

              <p
                className={
                  isDone
                    ? "mt-2 text-lg font-black text-emerald-200"
                    : "mt-2 text-lg font-black text-white"
                }
              >
                {progress.counts[status]}
              </p>
            </div>
          );
        })}
      </div>

      {progress.archivedCount > 0 ? (
        <p className="mt-3 text-xs font-bold text-white/35">
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
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-300/60"
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
          className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-300/60"
        />
      </div>

      <button
        type="submit"
        className="w-fit rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 px-6 py-3 text-sm font-black text-black transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
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
    <main className={layoutStyles.page}>
      <div className={layoutStyles.backgroundGlowOne} />
      <div className={layoutStyles.backgroundGlowTwo} />

      <div className={layoutStyles.shell}>
        <DashboardSidebar workspaceId={workspaceId} activePage="projects" />

        <section className={layoutStyles.content}>
          <header className={cardClass}>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
              Projects
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              {workspace.name} projects
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
              Organize your workspace into focused projects, track issues, and
              keep delivery moving.
            </p>
          </header>

          {successMessage ? (
            <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm font-bold text-emerald-100 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
              {successMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-[2rem] border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
              {errorMessage}
            </div>
          ) : null}

          <section className={cardClass}>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                Active projects
              </p>

              <h2 className="mt-2 text-2xl font-black">
                {activeProjects.length} active
              </h2>
            </div>

            {activeProjects.length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-dashed border-white/10 bg-black/25 p-6">
                <div className="max-w-2xl">
                  <h3 className="text-xl font-black text-white">
                    No active projects yet
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-white/45">
                    Create your first project to start organizing issues,
                    boards, and sprint work inside this workspace.
                  </p>
                </div>

                {canManageProjects ? (
                  <div className="mt-6 rounded-[2rem] border border-white/10 bg-black/25 p-5">
                    <CreateProjectForm workspaceId={workspaceId} />
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-white/45">
                    Only owners and admins can create projects.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {activeProjects.map((project) => (
                  <article key={project.id} className={projectCardClass}>
                    <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-amber-300/[0.035] blur-3xl transition group-hover:bg-amber-300/[0.07]" />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="truncate text-xl font-black text-white">
                            {project.name}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">
                            {project.description || "No description yet."}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                          Active
                        </span>
                      </div>

                      <IssueProgressPanel issues={project.issues} />

                      <div className="mt-5 flex gap-3 text-sm text-white/50">
                        <span>{project._count.issues} total issues</span>
                        <span>•</span>
                        <span>{project._count.sprints} sprints</span>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link
                          href={`/dashboard/${workspaceId}/projects/${project.id}`}
                          className="rounded-full bg-white px-5 py-2 text-sm font-black text-black transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                        >
                          Open project
                        </Link>

                        <Link
                          href={`/dashboard/${workspaceId}/projects/${project.id}/board`}
                          className="rounded-full border border-white/10 px-5 py-2 text-sm font-bold text-white/70 transition hover:-translate-y-0.5 hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
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
                              className="rounded-full border border-red-400/20 px-5 py-2 text-sm font-bold text-red-200 transition hover:-translate-y-0.5 hover:bg-red-400/10 active:translate-y-0 active:scale-[0.98]"
                            >
                              Archive
                            </button>
                          </form>
                        ) : null}
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
                <p className="text-sm font-black uppercase tracking-[0.25em] text-white/35">
                  New project
                </p>

                <h2 className="mt-2 text-2xl font-black">Create project</h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                  Add another project when your workspace has a new area of work
                  to track.
                </p>
              </div>

              <CreateProjectForm workspaceId={workspaceId} compact />
            </section>
          ) : null}

          {!canManageProjects ? (
            <section className={cardClass}>
              <h2 className="text-xl font-black">Project access</h2>

              <p className="mt-2 text-sm leading-6 text-white/50">
                You can view projects, but only owners and admins can create,
                archive, or restore projects.
              </p>
            </section>
          ) : null}

          <section className={cardClass}>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-white/35">
                Archived projects
              </p>

              <h2 className="mt-2 text-2xl font-black">
                {archivedProjects.length} archived
              </h2>
            </div>

            {archivedProjects.length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-dashed border-white/10 bg-black/25 p-6 text-sm text-white/45">
                No archived projects.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {archivedProjects.map((project) => (
                  <article
                    key={project.id}
                    className={archivedProjectCardClass}
                  >
                    <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-white/[0.025] blur-3xl" />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="truncate text-xl font-black text-white">
                            {project.name}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">
                            {project.description || "No description yet."}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-white/45">
                          Archived
                        </span>
                      </div>

                      <IssueProgressPanel issues={project.issues} />

                      <div className="mt-5 flex gap-3 text-sm text-white/50">
                        <span>{project._count.issues} total issues</span>
                        <span>•</span>
                        <span>{project._count.sprints} sprints</span>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link
                          href={`/dashboard/${workspaceId}/projects/${project.id}`}
                          className="rounded-full border border-white/10 px-5 py-2 text-sm font-bold text-white/70 transition hover:bg-white/5 hover:text-white"
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
                              className="rounded-full border border-emerald-400/20 px-5 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/10"
                            >
                              Restore
                            </button>
                          </form>
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
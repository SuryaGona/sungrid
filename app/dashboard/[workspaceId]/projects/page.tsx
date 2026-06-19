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

const createProjectSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1, "Project name is required.").max(80),
  description: z.string().trim().max(500).optional(),
});

const projectActionSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
});

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

  const { user } = await requireWorkspaceRole(workspaceId, [
    "OWNER",
    "ADMIN",
  ]);

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

  const { user } = await requireWorkspaceRole(workspaceId, [
    "OWNER",
    "ADMIN",
  ]);

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

  const { user } = await requireWorkspaceRole(workspaceId, [
    "OWNER",
    "ADMIN",
  ]);

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
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-6 px-6 py-8">
        <DashboardSidebar workspaceId={workspaceId} activePage="projects" />

        <section className="flex-1 space-y-6">
          <header className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
              Projects
            </p>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight">
                  {workspace.name} projects
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
                  Create workspace-scoped projects, open project detail pages,
                  archive completed work, and keep project actions auditable.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                  Your role
                </p>
                <p className="mt-1 text-lg font-black text-amber-300">
                  {membership.role}
                </p>
              </div>
            </div>
          </header>

          {successMessage ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm font-bold text-emerald-100">
              {successMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
              {errorMessage}
            </div>
          ) : null}

          {canManageProjects ? (
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-black">Create project</h2>

              <form action={createProject} className="mt-5 grid gap-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-bold text-white/70"
                  >
                    Project name
                  </label>

                  <input
                    id="name"
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
                    htmlFor="description"
                    className="block text-sm font-bold text-white/70"
                  >
                    Description
                  </label>

                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    maxLength={500}
                    placeholder="What is this project about?"
                    className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-300/60"
                  />
                </div>

                <button
                  type="submit"
                  className="w-fit rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 px-6 py-3 text-sm font-black text-black"
                >
                  Create project
                </button>
              </form>
            </section>
          ) : (
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-black">Project access</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                You can view projects, but only owners and admins can create,
                archive, or restore projects.
              </p>
            </section>
          )}

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                  Active projects
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {activeProjects.length} active
                </h2>
              </div>
            </div>

            {activeProjects.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm text-white/45">
                No active projects yet.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {activeProjects.map((project) => (
                  <article
                    key={project.id}
                    className="rounded-3xl border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-black">{project.name}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">
                          {project.description || "No description yet."}
                        </p>
                      </div>

                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                        Active
                      </span>
                    </div>

                    <div className="mt-5 flex gap-3 text-sm text-white/50">
                      <span>{project._count.issues} issues</span>
                      <span>•</span>
                      <span>{project._count.sprints} sprints</span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/dashboard/${workspaceId}/projects/${project.id}`}
                        className="rounded-full bg-white px-5 py-2 text-sm font-black text-black"
                      >
                        Open project
                      </Link>

                      <Link
                        href={`/dashboard/${workspaceId}/projects/${project.id}/board`}
                        className="rounded-full border border-white/10 px-5 py-2 text-sm font-bold text-white/70"
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
                            className="rounded-full border border-red-400/20 px-5 py-2 text-sm font-bold text-red-200"
                          >
                            Archive
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-white/35">
                Archived projects
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {archivedProjects.length} archived
              </h2>
            </div>

            {archivedProjects.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm text-white/45">
                No archived projects.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {archivedProjects.map((project) => (
                  <article
                    key={project.id}
                    className="rounded-3xl border border-white/10 bg-black/30 p-5 opacity-75"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-black">{project.name}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">
                          {project.description || "No description yet."}
                        </p>
                      </div>

                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-white/45">
                        Archived
                      </span>
                    </div>

                    <div className="mt-5 flex gap-3 text-sm text-white/50">
                      <span>{project._count.issues} issues</span>
                      <span>•</span>
                      <span>{project._count.sprints} sprints</span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/dashboard/${workspaceId}/projects/${project.id}`}
                        className="rounded-full border border-white/10 px-5 py-2 text-sm font-bold text-white/70"
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
                            className="rounded-full border border-emerald-400/20 px-5 py-2 text-sm font-bold text-emerald-200"
                          >
                            Restore
                          </button>
                        </form>
                      ) : null}
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
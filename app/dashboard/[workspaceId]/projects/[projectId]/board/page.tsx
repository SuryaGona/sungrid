import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ProjectBoard } from "@/components/project-board";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/workspace-auth";
import layoutStyles from "../../../workspace-dashboard.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoardPageProps = {
  params: Promise<{
    workspaceId: string;
    projectId: string;
  }>;
};

const metricCardClass =
  "min-w-0 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]";

const navCardClass =
  "min-w-0 rounded-[2rem] border border-white/10 bg-black/30 p-6 transition hover:-translate-y-0.5 hover:border-amber-300/25 hover:bg-white/[0.05] active:translate-y-0 active:scale-[0.99]";

export default async function ProjectBoardPage({ params }: BoardPageProps) {
  const { workspaceId, projectId } = await params;

  const { workspace } = await requireWorkspaceAccess(workspaceId);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      archived: true,
      _count: {
        select: {
          issues: true,
          sprints: true,
        },
      },
    },
  });

  if (!project) {
    redirect(`/dashboard/${workspaceId}/projects?error=project-not-found`);
  }

  const issues = await prisma.issue.findMany({
    where: {
      workspaceId,
      projectId,
      archived: false,
    },
    include: {
      reporter: true,
      assignee: true,
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
        createdAt: "asc",
      },
    ],
  });

  const boardIssues = issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    type: issue.type,
    storyPoints: issue.storyPoints,
    position: issue.position,
    reporterLabel: issue.reporter?.name || issue.reporter?.email || "Unknown",
    assigneeLabel:
      issue.assignee?.name || issue.assignee?.email || "Unassigned",
    sprintLabel: issue.sprint?.name || null,
  }));

  const doneCount = issues.filter((issue) => issue.status === "DONE").length;
  const openCount = Math.max(issues.length - doneCount, 0);
  const completionRate =
    issues.length === 0 ? 0 : Math.round((doneCount / issues.length) * 100);

  const metrics = [
    {
      label: "Visible issues",
      value: issues.length,
      detail: "Active work on this board",
    },
    {
      label: "Open work",
      value: openCount,
      detail: "Still moving through delivery",
    },
    {
      label: "Done",
      value: doneCount,
      detail: "Completed board items",
    },
    {
      label: "Completion",
      value: `${completionRate}%`,
      detail: `${project._count.issues} total project issues`,
    },
  ];

  return (
    <main className={layoutStyles.page}>
      <div className={layoutStyles.backgroundGlowOne} />
      <div className={layoutStyles.backgroundGlowTwo} />

      <div className={layoutStyles.shell}>
        <DashboardSidebar workspaceId={workspaceId} activePage="projects" />

        <section className={`${layoutStyles.content} overflow-hidden`}>
          <header className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}`}
              className="inline-flex w-fit rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white/55 transition hover:-translate-y-0.5 hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
              style={{ cursor: "pointer" }}
            >
              ← Back to project
            </Link>

            <div className="mt-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
                  Project board
                </p>

                <h1 className="mt-4 break-words text-4xl font-black tracking-tight text-white md:text-5xl">
                  {project.name}
                </h1>

                <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-white/50">
                  {project.description ||
                    "Move active issues through delivery stages and keep current work focused in one place."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {project.archived ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/55">
                    Archived project
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200">
                    Active project
                  </span>
                )}

                <span className="max-w-[280px] truncate rounded-full border border-white/10 bg-black/35 px-4 py-2 text-sm font-bold text-white/55">
                  {workspace.name}
                </span>
              </div>
            </div>
          </header>

          {project.archived ? (
            <section className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-6 text-amber-100">
              This project is archived. The board stays visible for review, but
              moving issues is locked.
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                  Board flow
                </p>

                <h2 className="mt-2 break-words text-2xl font-black text-white">
                  Current active issues
                </h2>

                <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-white/45">
                  Archived issues are hidden from this board so the team only
                  sees active work.
                </p>
              </div>

              <span className="w-fit rounded-full border border-white/10 bg-black/35 px-4 py-2 text-sm font-bold text-white/50">
                {project.archived ? "Read-only board" : "Drag to update"}
              </span>
            </div>
          </section>

          <ProjectBoard
            workspaceId={workspaceId}
            projectId={projectId}
            projectArchived={project.archived}
            initialIssues={boardIssues}
          />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className={metricCardClass}>
                <p className="break-words text-sm font-bold text-white/45">
                  {metric.label}
                </p>

                <strong className="mt-3 block break-words text-3xl font-black tracking-tight text-white">
                  {metric.value}
                </strong>

                <span className="mt-2 block break-words text-sm text-white/35">
                  {metric.detail}
                </span>
              </div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}`}
              className={navCardClass}
            >
              <p className="break-words text-lg font-black text-white">
                Project details
              </p>

              <p className="mt-2 break-words text-sm leading-6 text-white/45">
                Review active issues, archived issues, and create new work.
              </p>
            </Link>

            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}/sprints`}
              className={navCardClass}
            >
              <p className="break-words text-lg font-black text-white">
                Sprint planning
              </p>

              <p className="mt-2 break-words text-sm leading-6 text-white/45">
                Plan cycles, assign issues, complete sprints, and view reports.
              </p>
            </Link>

            <Link
              href={`/dashboard/${workspaceId}/analytics`}
              className={navCardClass}
            >
              <p className="break-words text-lg font-black text-white">
                Workspace analytics
              </p>

              <p className="mt-2 break-words text-sm leading-6 text-white/45">
                Review completion, sprint performance, and activity metrics.
              </p>
            </Link>
          </section>
        </section>
      </div>
    </main>
  );
}
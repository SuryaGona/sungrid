import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ProjectBoard } from "@/components/project-board";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/workspace-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoardPageProps = {
  params: Promise<{
    workspaceId: string;
    projectId: string;
  }>;
};

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

const contentClass = "grid w-full min-w-0 max-w-full gap-3 overflow-hidden";

const heroCardClass =
  "rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3.5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";

const sectionHeaderClass =
  "rounded-[1.2rem] border border-white/[0.08] bg-white/[0.025] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const metricCardClass =
  "min-w-0 rounded-[1.1rem] border border-white/10 bg-white/[0.035] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const navCardClass =
  "min-w-0 rounded-[1.1rem] border border-white/10 bg-black/30 p-3.5 no-underline shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition hover:-translate-y-px hover:border-[#d6bf76]/15 hover:bg-white/[0.035] active:translate-y-0 active:scale-[0.99]";

const boardFrameClass =
  "min-w-0 max-w-full overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/25 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";

const boardViewportClass = "min-w-0 max-w-full overflow-hidden px-2 py-2";

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

export default async function ProjectBoardPage({ params }: BoardPageProps) {
  const { workspaceId, projectId } = await params;

  const { workspace } = await requireWorkspaceAccess(workspaceId);

  const [project, issues] = await Promise.all([
    prisma.project.findFirst({
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
    }),

    prisma.issue.findMany({
      where: {
        workspaceId,
        projectId,
        archived: false,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        type: true,
        storyPoints: true,
        position: true,
        createdAt: true,
        reporter: {
          select: {
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            name: true,
            email: true,
          },
        },
        sprint: {
          select: {
            name: true,
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
    }),
  ]);

  if (!project) {
    redirect(`/dashboard/${workspaceId}/projects?error=project-not-found`);
  }

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

  const doneCount = issues.reduce(
    (total, issue) => total + (issue.status === "DONE" ? 1 : 0),
    0,
  );

  const openCount = Math.max(issues.length - doneCount, 0);
  const completionRate =
    issues.length === 0 ? 0 : Math.round((doneCount / issues.length) * 100);

  const metrics = [
    {
      label: "Visible issues",
      value: issues.length,
      detail: "Active board items",
    },
    {
      label: "Open work",
      value: openCount,
      detail: "Still in delivery",
    },
    {
      label: "Done",
      value: doneCount,
      detail: "Completed items",
    },
    {
      label: "Completion",
      value: `${completionRate}%`,
      detail: `${project._count.issues} total issues`,
    },
  ];

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
                className="inline-flex h-8 w-fit shrink-0 items-center rounded-full border border-white/10 px-3 text-xs font-bold text-white/55 no-underline transition hover:-translate-y-px hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
              >
                ← Back
              </Link>

              <div className="flex min-w-0 flex-wrap justify-end gap-2">
                {project.archived ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-extrabold text-white/55">
                    Archived
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-extrabold text-emerald-200">
                    Active
                  </span>
                )}

                <span className="max-w-[220px] truncate rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-xs font-bold text-white/50">
                  {workspace.name}
                </span>
              </div>
            </div>

            <div className="mt-3 min-w-0">
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
                Project board
              </p>

              <h1 className="m-0 mt-1 truncate text-[25px] font-extrabold tracking-[-0.04em] text-white md:text-[28px]">
                {project.name}
              </h1>

              <p className="m-0 mt-1 max-w-3xl truncate text-sm text-white/45">
                {project.description ||
                  "Move active issues through delivery stages."}
              </p>
            </div>
          </header>

          {project.archived ? (
            <section className="rounded-[1.2rem] border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] px-4 py-3 text-sm font-bold leading-6 text-[#f4e7b0] shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
              This project is archived. The board is visible for review, but
              moving issues is locked.
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className={metricCardClass}>
                <p className="m-0 truncate text-xs font-bold text-white/45">
                  {metric.label}
                </p>

                <strong className="mt-1.5 block truncate text-xl font-extrabold tracking-[-0.04em] text-white">
                  {metric.value}
                </strong>

                <span className="mt-1 block truncate text-xs text-white/35">
                  {metric.detail}
                </span>
              </div>
            ))}
          </section>

          <section className="grid min-w-0 max-w-full gap-3 overflow-hidden">
            <div className={sectionHeaderClass}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                    Board flow
                  </p>

                  <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                    Current active issues
                  </h2>
                </div>

                <span className="w-fit rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-xs font-bold text-white/50">
                  {project.archived ? "Read-only" : "Drag inside board"}
                </span>
              </div>
            </div>

            <div className={boardFrameClass}>
              <div className={boardViewportClass}>
                <ProjectBoard
                  workspaceId={workspaceId}
                  projectId={projectId}
                  projectArchived={project.archived}
                  initialIssues={boardIssues}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-3">
            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}`}
              className={navCardClass}
            >
              <p className="m-0 break-words text-sm font-extrabold text-white">
                Project details
              </p>

              <p className="m-0 mt-1 line-clamp-2 break-words text-sm leading-5 text-white/45">
                Review issues, archive history, and create new work.
              </p>
            </Link>

            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}/sprints`}
              className={navCardClass}
            >
              <p className="m-0 break-words text-sm font-extrabold text-white">
                Sprint planning
              </p>

              <p className="m-0 mt-1 line-clamp-2 break-words text-sm leading-5 text-white/45">
                Plan cycles, assign issues, and complete sprints.
              </p>
            </Link>

            <Link
              href={`/dashboard/${workspaceId}/analytics`}
              className={navCardClass}
            >
              <p className="m-0 break-words text-sm font-extrabold text-white">
                Analytics
              </p>

              <p className="m-0 mt-1 line-clamp-2 break-words text-sm leading-5 text-white/45">
                Review completion, sprint performance, and activity.
              </p>
            </Link>
          </section>
        </section>
      </div>
    </main>
  );
}
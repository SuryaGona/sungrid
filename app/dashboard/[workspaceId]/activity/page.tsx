import Link from "next/link";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/workspace-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActivityPageProps = {
  params: Promise<{
    workspaceId: string;
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

const cardClass =
  "rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";

const sectionHeaderClass =
  "rounded-[1.2rem] border border-white/[0.08] bg-white/[0.025] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const metricCardClass =
  "min-w-0 rounded-[1.1rem] border border-white/10 bg-white/[0.035] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const patternCardClass =
  "rounded-[1.1rem] border border-white/10 bg-black/30 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition hover:border-[#d6bf76]/15 hover:bg-white/[0.035]";

const eventCardClass =
  "rounded-[1.2rem] border border-white/10 bg-black/30 p-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition hover:border-[#d6bf76]/15 hover:bg-white/[0.035]";

const neutralPillClass =
  "rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-white/55";

const linkPillClass =
  "rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-white/55 no-underline transition hover:border-[#d6bf76]/20 hover:bg-[#d6bf76]/[0.08] hover:text-[#f4e7b0]";

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

function formatAction(action: string) {
  return action
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(date: Date) {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getActionTone(action: string) {
  if (
    action.includes("archived") ||
    action.includes("cancelled") ||
    action.includes("removed")
  ) {
    return "border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] text-[#f4e7b0]";
  }

  if (
    action.includes("completed") ||
    action.includes("restored") ||
    action.includes("created") ||
    action.includes("started") ||
    action.includes("added")
  ) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }

  if (action.includes("updated") || action.includes("moved")) {
    return "border-blue-400/20 bg-blue-400/10 text-blue-200";
  }

  return "border-white/10 bg-white/[0.05] text-white/55";
}

function getActorName(user: { name: string | null; email: string } | null) {
  if (!user) {
    return "Unknown user";
  }

  return user.name || user.email;
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { workspaceId } = await params;

  await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN"]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalActivityLogs,
    activityLast7Days,
    activityLast30Days,
    activityGroups,
    activityLogs,
  ] = await Promise.all([
    prisma.activityLog.count({
      where: {
        workspaceId,
      },
    }),

    prisma.activityLog.count({
      where: {
        workspaceId,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    }),

    prisma.activityLog.count({
      where: {
        workspaceId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    }),

    prisma.activityLog.groupBy({
      by: ["action"],
      where: {
        workspaceId,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          action: "desc",
        },
      },
      take: 6,
    }),

    prisma.activityLog.findMany({
      where: {
        workspaceId,
      },
      select: {
        id: true,
        action: true,
        description: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        issue: {
          select: {
            id: true,
            title: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
  ]);

  const metrics = [
    {
      label: "Total events",
      value: totalActivityLogs,
      helper: "All recorded actions",
    },
    {
      label: "Last 7 days",
      value: activityLast7Days,
      helper: "Recent movement",
    },
    {
      label: "Last 30 days",
      value: activityLast30Days,
      helper: "Monthly history",
    },
  ];

  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <div className={shellClass}>
        <DashboardSidebar workspaceId={workspaceId} activePage="activity" />

        <section className={contentClass}>
          <header className={heroCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
                  Workspace audit trail
                </p>

                <h1 className="m-0 mt-1 truncate text-[25px] font-extrabold tracking-[-0.04em] text-white md:text-[28px]">
                  Activity
                </h1>

                <p className="m-0 mt-1 max-w-3xl truncate text-sm text-white/45">
                  Important workspace actions across projects, issues, sprints,
                  reports, and members.
                </p>
              </div>

              <span className="rounded-full border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] px-2.5 py-1 text-xs font-extrabold text-[#f4e7b0]">
                Admin view
              </span>
            </div>
          </header>

          <section className="grid gap-3 md:grid-cols-3">
            {metrics.map((stat) => (
              <div key={stat.label} className={metricCardClass}>
                <p className="m-0 truncate text-xs font-bold text-white/45">
                  {stat.label}
                </p>

                <strong className="mt-1.5 block truncate text-xl font-extrabold tracking-[-0.04em] text-white">
                  {stat.value}
                </strong>

                <span className="mt-1 block truncate text-xs text-white/35">
                  {stat.helper}
                </span>
              </div>
            ))}
          </section>

          {activityGroups.length > 0 ? (
            <section className="grid gap-3">
              <div className={sectionHeaderClass}>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                  Action patterns
                </p>

                <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                  Common actions
                </h2>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {activityGroups.map((group) => (
                  <div key={group.action} className={patternCardClass}>
                    <p className="m-0 truncate text-sm font-extrabold text-white">
                      {formatAction(group.action)}
                    </p>

                    <strong className="mt-1.5 block text-xl font-extrabold tracking-[-0.04em] text-white">
                      {group._count._all}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                Latest events
              </p>

              <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                Recent audit history
              </h2>
            </div>

            {activityLogs.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/45 shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
                No activity yet. Create projects, issues, sprints, or reports
                to start building the audit trail.
              </div>
            ) : (
              <div className="grid gap-3">
                {activityLogs.map((log) => (
                  <article key={log.id} className={eventCardClass}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${getActionTone(
                              log.action,
                            )}`}
                          >
                            {formatAction(log.action)}
                          </span>

                          <span className={neutralPillClass}>
                            {getActorName(log.user)}
                          </span>
                        </div>

                        <p className="m-0 mt-2 max-w-4xl break-words text-sm leading-6 text-white/50">
                          {log.description || "Workspace action recorded."}
                        </p>

                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {log.project ? (
                            <Link
                              href={`/dashboard/${workspaceId}/projects/${log.project.id}`}
                              className={linkPillClass}
                            >
                              Project: {log.project.name}
                            </Link>
                          ) : null}

                          {log.issue && log.project ? (
                            <Link
                              href={`/dashboard/${workspaceId}/projects/${log.project.id}/issues/${log.issue.id}`}
                              className={linkPillClass}
                            >
                              Issue: {log.issue.title}
                            </Link>
                          ) : log.issue ? (
                            <span className={neutralPillClass}>
                              Issue: {log.issue.title}
                            </span>
                          ) : null}

                          {log.sprint && log.project ? (
                            <Link
                              href={`/dashboard/${workspaceId}/projects/${log.project.id}/sprints`}
                              className={linkPillClass}
                            >
                              Sprint: {log.sprint.name}
                            </Link>
                          ) : log.sprint ? (
                            <span className={neutralPillClass}>
                              Sprint: {log.sprint.name}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-white/35">
                        {formatDateTime(log.createdAt)}
                      </span>
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
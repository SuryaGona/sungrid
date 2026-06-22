import Link from "next/link";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/workspace-auth";
import layoutStyles from "../workspace-dashboard.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActivityPageProps = {
  params: Promise<{
    workspaceId: string;
  }>;
};

const cardClass =
  "rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]";

const innerCardClass =
  "rounded-[2rem] border border-white/10 bg-black/25 p-5";

const eventCardClass =
  "rounded-[2rem] border border-white/10 bg-black/25 p-6 transition hover:border-white/15 hover:bg-white/[0.04]";

const neutralPillClass =
  "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/45";

const linkPillClass =
  "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/45 transition hover:border-amber-300/25 hover:text-white";

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
    return "border-amber-300/20 bg-amber-300/10 text-amber-200";
  }

  if (
    action.includes("completed") ||
    action.includes("restored") ||
    action.includes("created") ||
    action.includes("started")
  ) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }

  if (action.includes("updated") || action.includes("moved")) {
    return "border-sky-300/20 bg-sky-300/10 text-sky-200";
  }

  return "border-white/10 bg-white/[0.04] text-white/50";
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
      include: {
        user: true,
        project: true,
        issue: true,
        sprint: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
  ]);

  return (
    <main className={layoutStyles.page}>
      <div className={layoutStyles.backgroundGlowOne} />
      <div className={layoutStyles.backgroundGlowTwo} />

      <div className={layoutStyles.shell}>
        <DashboardSidebar workspaceId={workspaceId} activePage="activity" />

        <section className={layoutStyles.content}>
          <header className={cardClass}>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
              Workspace audit trail
            </p>

            <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <h1 className="break-words text-4xl font-black tracking-tight text-white md:text-5xl">
                  Activity
                </h1>

                <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-white/50">
                  A clean record of important workspace actions across projects,
                  issues, sprints, reports, and members.
                </p>
              </div>

              <span className="w-fit rounded-full border border-white/10 bg-black/35 px-4 py-2 text-sm font-black text-white/55">
                Admin view
              </span>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                label: "Total events",
                value: totalActivityLogs,
                helper: "All recorded workspace actions",
              },
              {
                label: "Last 7 days",
                value: activityLast7Days,
                helper: "Recent team movement",
              },
              {
                label: "Last 30 days",
                value: activityLast30Days,
                helper: "Monthly operational history",
              },
            ].map((stat) => (
              <div key={stat.label} className={cardClass}>
                <p className="text-sm font-bold text-white/45">{stat.label}</p>

                <p className="mt-2 text-3xl font-black tracking-tight text-white">
                  {stat.value}
                </p>

                <p className="mt-2 text-sm text-white/35">{stat.helper}</p>
              </div>
            ))}
          </section>

          {activityGroups.length > 0 ? (
            <section className={cardClass}>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                Action patterns
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                Common actions
              </h2>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                {activityGroups.map((group) => (
                  <div key={group.action} className={innerCardClass}>
                    <p className="break-words text-sm font-black text-white">
                      {formatAction(group.action)}
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-white">
                      {group._count._all}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className={cardClass}>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                Latest events
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                Recent audit history
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/45">
                Showing the latest 50 audit events for this workspace.
              </p>
            </div>

            {activityLogs.length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-dashed border-white/10 bg-black/25 p-6">
                <p className="text-sm leading-6 text-white/45">
                  No activity yet. Create projects, issues, sprints, or reports
                  to start building the audit trail.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {activityLogs.map((log) => (
                  <div key={log.id} className={eventCardClass}>
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${getActionTone(
                              log.action,
                            )}`}
                          >
                            {formatAction(log.action)}
                          </span>

                          <span className={neutralPillClass}>
                            {getActorName(log.user)}
                          </span>
                        </div>

                        <p className="mt-3 break-words text-sm leading-6 text-white/55">
                          {log.description || "Workspace action recorded."}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
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

                      <p className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/35">
                        {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
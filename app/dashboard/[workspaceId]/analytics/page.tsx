import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/workspace-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  params: Promise<{
    workspaceId: string;
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

const cardClass =
  "rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]";

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAction(value: string) {
  return value
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPercent(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className={cardClass}>
      <p className="text-sm font-bold text-white/45">{label}</p>

      <p className="mt-2 text-3xl font-black tracking-tight text-white">
        {value}
      </p>

      <p className="mt-2 text-sm text-white/35">{helper}</p>
    </div>
  );
}

function DistributionCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: {
    label: string;
    value: number;
  }[];
  total: number;
}) {
  return (
    <div className={cardClass}>
      <h3 className="text-lg font-black text-white">{title}</h3>

      <div className="mt-5 space-y-5">
        {rows.length === 0 ? (
          <p className="text-sm text-white/45">No active data yet.</p>
        ) : (
          rows.map((row) => {
            const percent = getPercent(row.value, total);
            const barWidth = percent > 0 ? Math.max(percent, 2) : 0;

            return (
              <div key={row.label}>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-bold text-white/60">
                    {row.label}
                  </p>

                  <p className="text-sm font-black text-white">{row.value}</p>
                </div>

                <div className="mt-2 flex items-center gap-4">
                  <svg
                    className="block h-3 w-full"
                    style={{
                      flex: "1 1 auto",
                      minWidth: 120,
                    }}
                    viewBox="0 0 100 10"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="0"
                      y="0"
                      width="100"
                      height="10"
                      rx="5"
                      fill="rgba(255,255,255,0.16)"
                    />

                    <rect
                      x="0"
                      y="0"
                      width={barWidth}
                      height="10"
                      rx="5"
                      fill="#fde047"
                    />
                  </svg>

                  <p className="w-12 shrink-0 text-right text-sm font-black text-amber-300">
                    {percent}%
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { workspaceId } = await params;

  const { workspace } = await requireWorkspaceAccess(workspaceId);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    roleGroups,
    projectGroups,
    issueGroups,
    sprintGroups,
    sprintReportStats,
    statusGroups,
    priorityGroups,
    typeGroups,
    activityLast7Days,
    activityLast30Days,
    totalActivityLogs,
    recentActivityLogs,
    latestSprintReports,
  ] = await Promise.all([
    prisma.membership.groupBy({
      by: ["role"],
      where: {
        workspaceId,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.project.groupBy({
      by: ["archived"],
      where: {
        workspaceId,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.issue.groupBy({
      by: ["archived", "status"],
      where: {
        workspaceId,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.sprint.groupBy({
      by: ["status"],
      where: {
        workspaceId,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.sprintReport.aggregate({
      where: {
        workspaceId,
      },
      _count: {
        _all: true,
      },
      _avg: {
        velocity: true,
        completionRate: true,
      },
      _sum: {
        totalIssues: true,
        completedIssues: true,
        velocity: true,
      },
    }),

    prisma.issue.groupBy({
      by: ["status"],
      where: {
        workspaceId,
        archived: false,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.issue.groupBy({
      by: ["priority"],
      where: {
        workspaceId,
        archived: false,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.issue.groupBy({
      by: ["type"],
      where: {
        workspaceId,
        archived: false,
      },
      _count: {
        _all: true,
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

    prisma.activityLog.count({
      where: {
        workspaceId,
      },
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
      take: 8,
    }),

    prisma.sprintReport.findMany({
      where: {
        workspaceId,
      },
      include: {
        sprint: {
          include: {
            project: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
  ]);

  const ownerCount =
    roleGroups.find((group) => group.role === "OWNER")?._count._all ?? 0;

  const adminCount =
    roleGroups.find((group) => group.role === "ADMIN")?._count._all ?? 0;

  const memberCount =
    roleGroups.find((group) => group.role === "MEMBER")?._count._all ?? 0;

  const totalMembers = ownerCount + adminCount + memberCount;

  const activeProjects =
    projectGroups.find((group) => group.archived === false)?._count._all ?? 0;

  const archivedProjects =
    projectGroups.find((group) => group.archived === true)?._count._all ?? 0;

  const totalProjects = activeProjects + archivedProjects;

  const activeIssueRows = issueGroups.filter((group) => !group.archived);
  const archivedIssueRows = issueGroups.filter((group) => group.archived);

  const totalActiveIssues = activeIssueRows.reduce((total, group) => {
    return total + group._count._all;
  }, 0);

  const totalArchivedIssues = archivedIssueRows.reduce((total, group) => {
    return total + group._count._all;
  }, 0);

  const completedIssues =
    activeIssueRows.find((group) => group.status === "DONE")?._count._all ?? 0;

  const openIssues = Math.max(totalActiveIssues - completedIssues, 0);
  const completionRate = getPercent(completedIssues, totalActiveIssues);

  const plannedSprints =
    sprintGroups.find((group) => group.status === "PLANNED")?._count._all ?? 0;

  const activeSprints =
    sprintGroups.find((group) => group.status === "ACTIVE")?._count._all ?? 0;

  const completedSprints =
    sprintGroups.find((group) => group.status === "COMPLETED")?._count._all ??
    0;

  const totalSprints = plannedSprints + activeSprints + completedSprints;

  const sprintReportCount = sprintReportStats._count._all;
  const averageVelocity = Math.round(sprintReportStats._avg.velocity ?? 0);
  const totalReportedVelocity = sprintReportStats._sum.velocity ?? 0;

  const statusRows = ISSUE_STATUSES.map((status) => ({
    label: formatEnum(status),
    value:
      statusGroups.find((group) => group.status === status)?._count._all ?? 0,
  })).filter((row) => row.value > 0);

  const priorityRows = ISSUE_PRIORITIES.map((priority) => ({
    label: formatEnum(priority),
    value:
      priorityGroups.find((group) => group.priority === priority)?._count
        ._all ?? 0,
  })).filter((row) => row.value > 0);

  const typeRows = ISSUE_TYPES.map((type) => ({
    label: formatEnum(type),
    value: typeGroups.find((group) => group.type === type)?._count._all ?? 0,
  })).filter((row) => row.value > 0);

  return (
    <main className="min-h-screen bg-[#11131a]">
      <header className="border-b border-white/10 bg-white/[0.04]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
              SunGrid
            </p>

            <h1 className="text-xl font-black text-white">{workspace.name}</h1>
          </div>

          <UserButton />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <DashboardSidebar workspaceId={workspaceId} activePage="analytics" />

        <section className="space-y-6">
          <div className={cardClass}>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
              Workspace intelligence
            </p>

            <div className="mt-2">
              <h2 className="text-3xl font-black text-white">Analytics</h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                Real operational metrics from members, projects, active issues,
                sprint reports, and activity logs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard
              label="Members"
              value={totalMembers}
              helper={`${ownerCount} owner · ${adminCount} admin · ${memberCount} member`}
            />

            <StatCard
              label="Projects"
              value={totalProjects}
              helper={`${activeProjects} active · ${archivedProjects} archived`}
            />

            <StatCard
              label="Active issues"
              value={totalActiveIssues}
              helper={`${openIssues} open · ${completedIssues} done`}
            />

            <StatCard
              label="Completion rate"
              value={`${completionRate}%`}
              helper="Based on active non-archived issues"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard
              label="Sprints"
              value={totalSprints}
              helper={`${plannedSprints} planned · ${activeSprints} active · ${completedSprints} completed`}
            />

            <StatCard
              label="Sprint reports"
              value={sprintReportCount}
              helper="Generated from completed sprints"
            />

            <StatCard
              label="Average velocity"
              value={averageVelocity}
              helper={`${totalReportedVelocity} total completed points`}
            />

            <StatCard
              label="Recent activity"
              value={activityLast7Days}
              helper={`${activityLast30Days} events in last 30 days`}
            />
          </div>

          {totalArchivedIssues > 0 ? (
            <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-6 text-amber-100">
              <span className="font-black">Archived work:</span>{" "}
              {totalArchivedIssues} archived issue
              {totalArchivedIssues === 1 ? "" : "s"} excluded from active
              completion, sprint planning, and board metrics.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <DistributionCard
              title="Issue status"
              rows={statusRows}
              total={totalActiveIssues}
            />

            <DistributionCard
              title="Issue priority"
              rows={priorityRows}
              total={totalActiveIssues}
            />

            <DistributionCard
              title="Issue type"
              rows={typeRows}
              total={totalActiveIssues}
            />
          </div>

          <section className={cardClass}>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
              Workspace Health
            </p>

            <h3 className="mt-3 text-3xl font-black tracking-tight text-white">
              Current work
            </h3>

            <div className="mt-6 flex flex-row gap-4">
              <div className="min-w-0 flex-1 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-white/35">
                  Activity
                </p>

                <p className="mt-5 text-4xl font-black tracking-tight text-white">
                  {activityLast7Days}
                </p>
              </div>

              <div className="min-w-0 flex-1 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-white/35">
                  Open
                </p>

                <p className="mt-5 text-4xl font-black tracking-tight text-white">
                  {openIssues}
                </p>
              </div>

              <div className="min-w-0 flex-1 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-white/35">
                  Done
                </p>

                <p className="mt-5 text-4xl font-black tracking-tight text-white">
                  {completedIssues}
                </p>
              </div>
            </div>

            {latestSprintReports.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {latestSprintReports.slice(0, 2).map((report) => (
                  <div
                    key={report.id}
                    className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white">
                          {report.sprint.name}
                        </p>

                        <p className="mt-1 truncate text-sm font-bold text-white/40">
                          {report.sprint.project.name}
                        </p>
                      </div>

                      <Link
                        href={`/dashboard/${workspaceId}/projects/${report.sprint.projectId}/sprints`}
                        className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-white/45 transition hover:text-white/70"
                      >
                        View
                      </Link>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/40">
                        Total {report.totalIssues}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/40">
                        Done {report.completedIssues}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/40">
                        Rate {report.completionRate}%
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/40">
                        Velocity {report.velocity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className={cardClass}>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
                Recent Activity
              </p>

              <h3 className="mt-3 text-3xl font-black tracking-tight text-white">
                Latest updates
              </h3>
            </div>

            {recentActivityLogs.length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-dashed border-white/10 bg-white/[0.04] p-6">
                <p className="text-sm text-white/45">
                  No activity recorded yet.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {recentActivityLogs.slice(0, 4).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-base font-black text-white">
                          {formatAction(log.action)}
                        </p>

                        <p
                          className="mt-2 text-sm font-bold leading-6 text-white/35"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {log.description || "Workspace activity recorded."}
                        </p>
                      </div>

                      <p className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/30">
                        {log.createdAt.toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
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
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

const statCardClass =
  "min-w-0 rounded-[1.1rem] border border-white/10 bg-white/[0.035] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const panelCardClass =
  "rounded-[1.2rem] border border-white/10 bg-black/30 p-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition hover:border-[#d6bf76]/15 hover:bg-white/[0.035]";

const miniCardClass =
  "rounded-[1.1rem] border border-white/10 bg-black/25 p-4 shadow-[0_14px_36px_rgba(0,0,0,0.14)]";

const badgeClass =
  "rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-white/55";

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

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
    <div className={statCardClass}>
      <p className="m-0 truncate text-xs font-bold text-white/45">{label}</p>

      <strong className="mt-1.5 block truncate text-xl font-extrabold tracking-[-0.04em] text-white">
        {value}
      </strong>

      <span className="mt-1 block truncate text-xs text-white/35">
        {helper}
      </span>
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
    <div className={panelCardClass}>
      <h3 className="m-0 text-sm font-extrabold text-white">{title}</h3>

      <div className="mt-3 grid gap-3">
        {rows.length === 0 ? (
          <p className="m-0 text-sm text-white/45">No active data yet.</p>
        ) : (
          rows.map((row) => {
            const percent = getPercent(row.value, total);
            const barWidth = percent > 0 ? Math.max(percent, 2) : 0;

            return (
              <div key={row.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="m-0 truncate text-xs font-bold text-white/55">
                    {row.label}
                  </p>

                  <p className="m-0 shrink-0 text-xs font-extrabold text-white">
                    {row.value}
                  </p>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <svg
                    className="block h-2.5 w-full"
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
                      fill="rgba(255,255,255,0.12)"
                    />

                    <rect
                      x="0"
                      y="0"
                      width={barWidth}
                      height="10"
                      rx="5"
                      fill="rgba(214,191,118,0.82)"
                    />
                  </svg>

                  <p className="m-0 w-10 shrink-0 text-right text-xs font-extrabold text-[#f4e7b0]">
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

    prisma.activityLog.findMany({
      where: {
        workspaceId,
      },
      select: {
        id: true,
        action: true,
        description: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 4,
    }),

    prisma.sprintReport.findMany({
      where: {
        workspaceId,
      },
      select: {
        id: true,
        totalIssues: true,
        completedIssues: true,
        completionRate: true,
        velocity: true,
        sprint: {
          select: {
            name: true,
            projectId: true,
            project: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 2,
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
  const averageCompletion = Math.round(
    sprintReportStats._avg.completionRate ?? 0,
  );
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
    <main className={pageClass}>
      <BackgroundGlows />

      <div className={shellClass}>
        <DashboardSidebar workspaceId={workspaceId} activePage="analytics" />

        <section className={contentClass}>
          <header className={heroCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
                  Workspace intelligence
                </p>

                <h1 className="m-0 mt-1 truncate text-[25px] font-extrabold tracking-[-0.04em] text-white md:text-[28px]">
                  Analytics
                </h1>

                <p className="m-0 mt-1 max-w-3xl truncate text-sm text-white/45">
                  Operational metrics from projects, issues, sprints, and
                  activity.
                </p>
              </div>

              <span className="max-w-[220px] truncate rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-xs font-bold text-white/50">
                {workspace.name}
              </span>
            </div>
          </header>

          <section className="grid gap-3 md:grid-cols-4">
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
              label="Completion"
              value={`${completionRate}%`}
              helper="Active issues only"
            />
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <StatCard
              label="Sprints"
              value={totalSprints}
              helper={`${plannedSprints} planned · ${activeSprints} active · ${completedSprints} done`}
            />

            <StatCard
              label="Reports"
              value={sprintReportCount}
              helper="Completed sprint reports"
            />

            <StatCard
              label="Avg velocity"
              value={averageVelocity}
              helper={`${totalReportedVelocity} total done points`}
            />

            <StatCard
              label="Recent activity"
              value={activityLast7Days}
              helper={`${activityLast30Days} events in 30 days`}
            />
          </section>

          {totalArchivedIssues > 0 ? (
            <section className="rounded-[1.2rem] border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] px-4 py-3 text-sm font-bold leading-6 text-[#f4e7b0] shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
              {totalArchivedIssues} archived issue
              {totalArchivedIssues === 1 ? "" : "s"} excluded from active
              completion, sprint planning, and board metrics.
            </section>
          ) : null}

          <section className="grid gap-3 lg:grid-cols-3">
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
          </section>

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                Workspace health
              </p>

              <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                Current work
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className={miniCardClass}>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
                  Activity
                </p>

                <strong className="mt-2 block text-2xl font-extrabold tracking-[-0.04em] text-white">
                  {activityLast7Days}
                </strong>
              </div>

              <div className={miniCardClass}>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
                  Open
                </p>

                <strong className="mt-2 block text-2xl font-extrabold tracking-[-0.04em] text-white">
                  {openIssues}
                </strong>
              </div>

              <div className={miniCardClass}>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
                  Done
                </p>

                <strong className="mt-2 block text-2xl font-extrabold tracking-[-0.04em] text-white">
                  {completedIssues}
                </strong>
              </div>

              <div className={miniCardClass}>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
                  Avg rate
                </p>

                <strong className="mt-2 block text-2xl font-extrabold tracking-[-0.04em] text-white">
                  {averageCompletion}%
                </strong>
              </div>
            </div>

            {latestSprintReports.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {latestSprintReports.map((report) => (
                  <div key={report.id} className={panelCardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-extrabold text-white">
                          {report.sprint.name}
                        </p>

                        <p className="m-0 mt-1 truncate text-xs font-bold text-white/40">
                          {report.sprint.project.name}
                        </p>
                      </div>

                      <Link
                        href={`/dashboard/${workspaceId}/projects/${report.sprint.projectId}/sprints`}
                        className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/45 no-underline transition hover:bg-white/[0.07] hover:text-white/75"
                      >
                        View
                      </Link>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={badgeClass}>Total {report.totalIssues}</span>
                      <span className={badgeClass}>
                        Done {report.completedIssues}
                      </span>
                      <span className={badgeClass}>
                        Rate {report.completionRate}%
                      </span>
                      <span className={badgeClass}>
                        Velocity {report.velocity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                Recent activity
              </p>

              <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                Latest updates
              </h2>
            </div>

            {recentActivityLogs.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/45 shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
                No activity recorded yet.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {recentActivityLogs.map((log) => (
                  <article key={log.id} className={panelCardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 text-sm font-extrabold text-white">
                          {formatAction(log.action)}
                        </p>

                        <p className="m-0 mt-1 line-clamp-2 text-sm leading-5 text-white/38">
                          {log.description || "Workspace activity recorded."}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-white/30">
                        {log.createdAt.toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
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
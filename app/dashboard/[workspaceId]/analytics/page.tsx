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

function getHealthLabel(completionRate: number, activeIssues: number) {
  if (activeIssues === 0) {
    return "No active issues";
  }

  if (completionRate >= 75) {
    return "Strong";
  }

  if (completionRate >= 40) {
    return "Moving";
  }

  if (completionRate > 0) {
    return "Early";
  }

  return "Needs work";
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
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-2 text-sm text-gray-500">{helper}</p>
    </div>
  );
}

function ProgressBar({
  value,
  total,
}: {
  value: number;
  total: number;
}) {
  const percent = getPercent(value, total);

  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full bg-black"
        style={{
          width: `${percent}%`,
        }}
      />
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
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

      <div className="mt-5 space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No active data yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-gray-700">
                  {row.label}
                </p>

                <p className="text-sm text-gray-500">
                  {row.value} · {getPercent(row.value, total)}%
                </p>
              </div>

              <ProgressBar value={row.value} total={total} />
            </div>
          ))
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
  const averageSprintCompletion = Math.round(
    sprintReportStats._avg.completionRate ?? 0,
  );

  const totalReportedIssues = sprintReportStats._sum.totalIssues ?? 0;
  const totalReportedCompletedIssues =
    sprintReportStats._sum.completedIssues ?? 0;

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

  const healthLabel = getHealthLabel(completionRate, totalActiveIssues);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-gray-500">SunGrid</p>
            <h1 className="text-xl font-bold text-gray-900">
              {workspace.name}
            </h1>
          </div>

          <UserButton />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <DashboardSidebar workspaceId={workspaceId} activePage="analytics" />

        <section className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Workspace intelligence
            </p>

            <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Analytics
                </h2>

                <p className="mt-2 max-w-2xl text-gray-600">
                  Real operational metrics from members, projects, active
                  issues, sprint reports, and activity logs.
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                Health: {healthLabel}
              </span>
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
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              <span className="font-semibold">Archived work:</span>{" "}
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Sprint report performance
                </h3>

                <p className="mt-1 text-sm text-gray-600">
                  Delivery metrics calculated from completed sprint reports.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Avg completion</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {averageSprintCompletion}%
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Reported issues</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {totalReportedIssues}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Reported done</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {totalReportedCompletedIssues}
                  </p>
                </div>
              </div>

              {latestSprintReports.length === 0 ? (
                <div className="border-t border-gray-200 p-6">
                  <p className="text-sm text-gray-500">
                    No sprint reports yet. Complete a sprint to generate one.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 border-t border-gray-200">
                  {latestSprintReports.map((report) => (
                    <div key={report.id} className="p-6">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {report.sprint.name}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {report.sprint.project.name}
                          </p>
                        </div>

                        <Link
                          href={`/dashboard/${workspaceId}/projects/${report.sprint.projectId}/sprints`}
                          className="text-sm font-medium text-gray-700 hover:text-gray-950"
                        >
                          View sprint →
                        </Link>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-gray-600">
                        {report.generatedSummary ||
                          "Report generated for this completed sprint."}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          Total: {report.totalIssues}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          Done: {report.completedIssues}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          Rate: {report.completionRate}%
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          Velocity: {report.velocity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Recent activity
                </h3>

                <p className="mt-1 text-sm text-gray-600">
                  Latest workspace events across projects, issues, and sprints.
                </p>
              </div>

              {recentActivityLogs.length === 0 ? (
                <div className="p-6">
                  <p className="text-sm text-gray-500">
                    No activity has been recorded yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {recentActivityLogs.map((log) => (
                    <div key={log.id} className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatAction(log.action)}
                          </p>

                          <p className="mt-1 text-sm leading-6 text-gray-600">
                            {log.description || "Workspace activity recorded."}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          {log.createdAt.toLocaleDateString()}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                        {log.user ? (
                          <span className="rounded-full bg-gray-100 px-2 py-1">
                            {log.user.name || log.user.email || "User"}
                          </span>
                        ) : null}

                        {log.project ? (
                          <span className="rounded-full bg-gray-100 px-2 py-1">
                            {log.project.name}
                          </span>
                        ) : null}

                        {log.issue ? (
                          <span className="rounded-full bg-gray-100 px-2 py-1">
                            {log.issue.title}
                          </span>
                        ) : null}

                        {log.sprint ? (
                          <span className="rounded-full bg-gray-100 px-2 py-1">
                            {log.sprint.name}
                          </span>
                        ) : null}

                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          {log.createdAt.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-200 p-6">
                <p className="text-sm text-gray-500">
                  Total activity logs:{" "}
                  <span className="font-semibold text-gray-900">
                    {totalActivityLogs}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
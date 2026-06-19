import { UserButton } from "@clerk/nextjs";
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
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (
    action.includes("completed") ||
    action.includes("restored") ||
    action.includes("created") ||
    action.includes("started")
  ) {
    return "border-green-200 bg-green-50 text-green-800";
  }

  if (action.includes("updated") || action.includes("moved")) {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
}

function getActorName(user: { name: string | null; email: string } | null) {
  if (!user) {
    return "Unknown user";
  }

  return user.name || user.email;
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { workspaceId } = await params;

  const { workspace } = await requireWorkspaceRole(workspaceId, [
    "OWNER",
    "ADMIN",
  ]);

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
        <DashboardSidebar workspaceId={workspaceId} activePage="activity" />

        <section className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Workspace audit trail
            </p>

            <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Activity</h2>

                <p className="mt-2 max-w-2xl text-gray-600">
                  A clean record of important workspace actions across projects,
                  issues, sprints, reports, and members.
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                Admin view
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Total events</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {totalActivityLogs}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                All recorded workspace actions
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Last 7 days</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {activityLast7Days}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Recent team movement
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Last 30 days</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {activityLast30Days}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Monthly operational history
              </p>
            </div>
          </div>

          {activityGroups.length > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">
                Common actions
              </h3>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                {activityGroups.map((group) => (
                  <div
                    key={group.action}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {formatAction(group.action)}
                    </p>

                    <p className="mt-2 text-2xl font-bold text-gray-900">
                      {group._count._all}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Latest events
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                Showing the latest 50 audit events for this workspace.
              </p>
            </div>

            {activityLogs.length === 0 ? (
              <div className="p-6">
                <p className="text-sm text-gray-600">
                  No activity yet. Create projects, issues, sprints, or reports
                  to start building the audit trail.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {activityLogs.map((log) => (
                  <div key={log.id} className="p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getActionTone(
                              log.action,
                            )}`}
                          >
                            {formatAction(log.action)}
                          </span>

                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                            {getActorName(log.user)}
                          </span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-gray-700">
                          {log.description || "Workspace action recorded."}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                          {log.project ? (
                            <Link
                              href={`/dashboard/${workspaceId}/projects/${log.project.id}`}
                              className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600 hover:bg-gray-200"
                            >
                              Project: {log.project.name}
                            </Link>
                          ) : null}

                          {log.issue && log.project ? (
                            <Link
                              href={`/dashboard/${workspaceId}/projects/${log.project.id}/issues/${log.issue.id}`}
                              className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600 hover:bg-gray-200"
                            >
                              Issue: {log.issue.title}
                            </Link>
                          ) : log.issue ? (
                            <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600">
                              Issue: {log.issue.title}
                            </span>
                          ) : null}

                          {log.sprint && log.project ? (
                            <Link
                              href={`/dashboard/${workspaceId}/projects/${log.project.id}/sprints`}
                              className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600 hover:bg-gray-200"
                            >
                              Sprint: {log.sprint.name}
                            </Link>
                          ) : log.sprint ? (
                            <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600">
                              Sprint: {log.sprint.name}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p className="shrink-0 text-xs font-medium text-gray-500">
                        {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
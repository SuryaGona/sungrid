import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { prisma } from "@/lib/db";
import {
  requireWorkspaceAccess,
  WorkspaceDatabaseError,
} from "@/lib/workspace-auth";
import styles from "./workspace-dashboard.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DashboardPageProps = {
  params: Promise<{
    workspaceId: string;
  }>;
};

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function SunLogo() {
  return (
    <div className={styles.logoWrap} aria-hidden="true">
      <svg viewBox="0 0 80 80" className={styles.logo}>
        <defs>
          <linearGradient
            id="workspaceSunGradient"
            x1="16"
            y1="10"
            x2="66"
            y2="70"
          >
            <stop offset="0%" stopColor="#FFF7AD" />
            <stop offset="45%" stopColor="#FDBA33" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
        </defs>

        <path
          d="M40 7V17M40 63V73M7 40H17M63 40H73M16.5 16.5L23.5 23.5M56.5 56.5L63.5 63.5M63.5 16.5L56.5 23.5M23.5 56.5L16.5 63.5"
          stroke="#FDE68A"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <circle cx="40" cy="40" r="22" fill="url(#workspaceSunGradient)" />
      </svg>
    </div>
  );
}

function DashboardUnavailable() {
  return (
    <main className={styles.page}>
      <div className={styles.backgroundGlowOne} />
      <div className={styles.backgroundGlowTwo} />

      <section className={styles.content}>
        <div className={styles.heroCard}>
          <div>
            <p className={styles.kicker}>Connection issue</p>
            <h2>Dashboard could not load.</h2>
            <p className={styles.heroText}>
              SunGrid could not reach the workspace database right now. Your
              data is still safe. Try again in a moment.
            </p>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <Link href="/dashboard" className={styles.headerButton}>
                Try again
              </Link>

              <Link href="/" className={styles.smallLink}>
                Home
              </Link>
            </div>
          </div>

          <div className={styles.roleCard}>
            <span>Status</span>
            <strong>Retry</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

async function getDashboardData(workspaceId: string) {
  const context = await requireWorkspaceAccess(workspaceId);

  const [
    memberCount,
    activityCount,
    projectCount,
    activeProjectCount,
    issueCount,
    completedIssueCount,
    recentActivity,
  ] = await Promise.all([
    prisma.membership.count({
      where: {
        workspaceId,
      },
    }),

    prisma.activityLog.count({
      where: {
        workspaceId,
      },
    }),

    prisma.project.count({
      where: {
        workspaceId,
      },
    }),

    prisma.project.count({
      where: {
        workspaceId,
        archived: false,
      },
    }),

    prisma.issue.count({
      where: {
        workspaceId,
        archived: false,
      },
    }),

    prisma.issue.count({
      where: {
        workspaceId,
        archived: false,
        status: "DONE",
      },
    }),

    prisma.activityLog.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 4,
      select: {
        id: true,
        action: true,
        description: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    ...context,
    memberCount,
    activityCount,
    projectCount,
    activeProjectCount,
    issueCount,
    completedIssueCount,
    recentActivity,
  };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { workspaceId } = await params;

  let data: Awaited<ReturnType<typeof getDashboardData>>;

  try {
    data = await getDashboardData(workspaceId);
  } catch (error) {
    console.error("Workspace dashboard load failed:", error);

    if (error instanceof WorkspaceDatabaseError) {
      return <DashboardUnavailable />;
    }

    return <DashboardUnavailable />;
  }

  const {
    user,
    membership,
    workspace,
    memberCount,
    activityCount,
    projectCount,
    activeProjectCount,
    issueCount,
    completedIssueCount,
    recentActivity,
  } = data;

  const roleLabel = formatRole(membership.role);
  const completionRate =
    issueCount === 0 ? 0 : Math.round((completedIssueCount / issueCount) * 100);

  const firstName =
    user.name?.split(" ")[0] || user.email.split("@")[0] || "there";

  return (
    <main className={styles.page}>
      <div className={styles.backgroundGlowOne} />
      <div className={styles.backgroundGlowTwo} />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.workspaceBrand}>
            <SunLogo />

            <div>
              <p>SunGrid</p>
              <h1>{workspace.name}</h1>
            </div>
          </div>

          <div className={styles.headerActions}>
            <Link
              href={`/dashboard/${workspaceId}/projects`}
              className={styles.headerButton}
            >
              Projects
            </Link>

            <UserButton  />
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <DashboardSidebar workspaceId={workspaceId} activePage="overview" />

        <section className={styles.content}>
          <section className={styles.heroCard}>
            <div>
              <p className={styles.kicker}>Dashboard overview</p>

              <h2>Welcome back, {firstName}.</h2>

              <p className={styles.heroText}>
                Manage workspace projects, issues, members, and activity from
                one focused command center.
              </p>
            </div>

            <div className={styles.roleCard}>
              <span>Your role</span>
              <strong>{roleLabel}</strong>
            </div>
          </section>

          <section className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <p>Members</p>
              <strong>{memberCount}</strong>
            </div>

            <div className={styles.metricCard}>
              <p>Active projects</p>
              <strong>{activeProjectCount}</strong>
              <span>{projectCount} total</span>
            </div>

            <div className={styles.metricCard}>
              <p>Issues</p>
              <strong>{issueCount}</strong>
            </div>

            <div className={styles.metricCard}>
              <p>Completion</p>
              <strong>{completionRate}%</strong>
              <span>{completedIssueCount} done</span>
            </div>
          </section>

          <section className={styles.mainGrid}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.kicker}>Workspace health</p>
                  <h3>Core SaaS system active</h3>
                </div>

                <span className={styles.statusPill}>Live</span>
              </div>

              <div className={styles.healthGrid}>
                <div>
                  <p>Activity logs</p>
                  <strong>{activityCount}</strong>
                </div>

                <div>
                  <p>Open issues</p>
                  <strong>{Math.max(issueCount - completedIssueCount, 0)}</strong>
                </div>

                <div>
                  <p>Plan</p>
                  <strong>Free</strong>
                </div>
              </div>

              <div className={styles.note}>
                Workspace data is scoped by membership. Server-side guards
                protect access before loading projects, issues, members, and
                activity.
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.kicker}>Recent activity</p>
                  <h3>Audit trail</h3>
                </div>

                <Link
                  href={`/dashboard/${workspaceId}/activity`}
                  className={styles.smallLink}
                >
                  View all
                </Link>
              </div>

              <div className={styles.activityList}>
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className={styles.activityItem}>
                      <div>
                        <p>{activity.action}</p>
                        <span>{activity.description}</span>
                      </div>

                      <time>{formatDate(activity.createdAt)}</time>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <p>No activity yet.</p>
                    <span>Project and issue actions will appear here.</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
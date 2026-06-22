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

function formatActivityAction(action: string) {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function SunLogo() {
  return (
    <div className={styles.logoWrap} aria-hidden="true">
      <svg viewBox="0 0 80 80" className={styles.logo} role="img">
        <defs>
          <linearGradient
            id="workspaceSunGradient"
            x1="18"
            y1="12"
            x2="64"
            y2="68"
          >
            <stop offset="0%" stopColor="#FFF7AD" />
            <stop offset="45%" stopColor="#FDBA33" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>

          <filter
            id="workspaceSunGlow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 1  0 0.65 0 0 0.55  0 0 0.1 0 0  0 0 0 0.75 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx="40"
          cy="40"
          r="22"
          fill="url(#workspaceSunGradient)"
          filter="url(#workspaceSunGlow)"
        />

        <path
          d="M40 8V18M40 62V72M8 40H18M62 40H72M17.4 17.4L24.5 24.5M55.5 55.5L62.6 62.6M62.6 17.4L55.5 24.5M24.5 55.5L17.4 62.6"
          stroke="#FDE68A"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <path
          d="M29 35H51M29 45H51M35 29V51M45 29V51"
          stroke="#111827"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.75"
        />
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
            <h2>Dashboard could not load</h2>
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

  const isGuestWorkspace = Boolean(user.isGuest || workspace.isGuest);
  const roleLabel = isGuestWorkspace ? "Guest" : formatRole(membership.role);

  const displayName = isGuestWorkspace
    ? "Guest"
    : user.name?.split(" ")[0] || user.email.split("@")[0] || "there";

  const openIssueCount = Math.max(issueCount - completedIssueCount, 0);
  const completionRate =
    issueCount === 0 ? 0 : Math.round((completedIssueCount / issueCount) * 100);

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
            <UserButton />
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <DashboardSidebar workspaceId={workspaceId} activePage="overview" />

        <section className={styles.content}>
          <section className={styles.heroCard}>
            <div>
              <p className={styles.kicker}>Dashboard overview</p>

              <h2>Welcome, {displayName}</h2>

              <p className={styles.heroText}>
                Track projects, issues, sprints, and recent activity from one
                focused place.
              </p>

              {isGuestWorkspace ? (
                <div className={styles.note}>
                  <strong>Sample workspace:</strong>{" "}
                  This guest workspace includes sample projects, issues,
                  sprints, and activity so you can explore SunGrid without
                  setting up an account.
                </div>
              ) : null}
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
                  <h3>Current work</h3>
                </div>

                <span className={styles.statusPill}>Live</span>
              </div>

              <div className={styles.healthGrid}>
                <div>
                  <p>Activity</p>
                  <strong>{activityCount}</strong>
                </div>

                <div>
                  <p>Open issues</p>
                  <strong>{openIssueCount}</strong>
                </div>

                <div>
                  <p>Completed</p>
                  <strong>{completedIssueCount}</strong>
                </div>
              </div>

              <div className={styles.note}>
                Recent project, issue, and sprint updates are tracked here so
                your team can stay aligned.
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.kicker}>Recent activity</p>
                  <h3>Latest updates</h3>
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
                        <p>{formatActivityAction(activity.action)}</p>
                        <span>{activity.description}</span>
                      </div>

                      <time>{formatDate(activity.createdAt)}</time>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <p>No activity yet.</p>
                    <span>Project and issue updates will appear here.</span>
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
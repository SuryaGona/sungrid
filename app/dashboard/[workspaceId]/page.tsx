import Link from "next/link";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { prisma } from "@/lib/db";
import {
  requireWorkspaceAccess,
  WorkspaceDatabaseError,
} from "@/lib/workspace-auth";

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
    <div
      className="
        flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px]
        border border-[#d6bf76]/[0.22]
        bg-[linear-gradient(145deg,rgba(201,162,74,0.18),rgba(111,78,30,0.08))]
        shadow-[0_0_30px_rgba(201,162,74,0.14)]
      "
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80" className="h-[29px] w-[29px]" role="img">
        <defs>
          <linearGradient
            id="workspaceSunGradient"
            x1="18"
            y1="12"
            x2="64"
            y2="68"
          >
            <stop offset="0%" stopColor="#F4E7B0" />
            <stop offset="45%" stopColor="#C8A14A" />
            <stop offset="100%" stopColor="#6F4E1E" />
          </linearGradient>

          <filter
            id="workspaceSunGlow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0.9 0 0 0 0.75  0 0.65 0 0 0.45  0 0 0.25 0 0.12  0 0 0 0.55 0"
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
          stroke="#D6BF76"
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

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-xs font-extrabold uppercase tracking-[0.14em] text-[#d6bf76]">
      {children}
    </p>
  );
}

function DashboardUnavailable() {
  return (
    <main
      className="
        relative min-h-screen overflow-x-hidden bg-[#050505] text-white
        bg-[radial-gradient(circle_at_50%_-10%,rgba(201,162,74,0.1),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(111,78,30,0.08),transparent_28%),#050505]
        before:pointer-events-none before:fixed before:inset-0 before:content-['']
        before:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]
        before:bg-[size:58px_58px]
        before:[mask-image:radial-gradient(circle_at_center,black,transparent_78%)]
      "
    >
      <div
        className="
          pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px]
          rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]
        "
      />

      <div
        className="
          pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px]
          rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]
        "
      />

      <section
        className="
          relative z-[1] mx-auto grid min-h-screen w-[calc(100vw-56px)] max-w-[1680px]
          place-items-center py-7
          max-[1180px]:w-[min(100%,calc(100vw-40px))]
          max-[560px]:w-[min(100%,calc(100vw-28px))]
        "
      >
        <div
          className="
            w-[min(100%,560px)] rounded-[28px] border border-white/10
            bg-[radial-gradient(circle_at_20%_0%,rgba(214,191,118,0.12),transparent_34%),rgba(12,12,12,0.92)]
            p-8 text-center backdrop-blur-[20px]
            shadow-[0_24px_70px_rgba(0,0,0,0.32)]
            max-[560px]:rounded-3xl max-[560px]:px-[22px] max-[560px]:py-[26px]
          "
        >
          <Kicker>Connection issue</Kicker>

          <h1
            className="
              m-0 mt-3 text-[clamp(30px,4vw,42px)] font-extrabold leading-[0.98]
              tracking-[-0.06em] text-white
            "
          >
            Dashboard could not load
          </h1>

          <p
            className="
              mx-auto mb-0 mt-4 max-w-[440px] text-sm leading-[1.7] text-white/50
            "
          >
            SunGrid could not reach the workspace database right now. Your data
            is still safe. Try again in a moment.
          </p>

          <div className="mt-[26px] flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="
                inline-flex min-h-[42px] items-center rounded-full border border-[#d6bf76]/20
                bg-[#d6bf76]/[0.09] px-[18px] text-sm font-bold text-[#e8d28a]
                no-underline transition-[transform,background,border-color,color]
                duration-[160ms] ease-in-out
                hover:-translate-y-px hover:border-[#d6bf76]/30
                hover:bg-[#d6bf76]/[0.14] hover:text-[#f7e8a5]
                max-[560px]:hidden
              "
            >
              Try again
            </Link>

            <Link
              href="/"
              className="
                inline-flex min-h-[42px] items-center rounded-full border border-white/[0.08]
                px-4 text-[13px] font-bold text-white/50 no-underline
                transition-[transform,color,background,border-color]
                duration-[160ms] ease-in-out
                hover:-translate-y-px hover:border-white/[0.14]
                hover:bg-white/[0.06] hover:text-white
              "
            >
              Home
            </Link>
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
    <main
      className="
        relative min-h-screen overflow-x-hidden bg-[#050505] text-white
        bg-[radial-gradient(circle_at_50%_-10%,rgba(201,162,74,0.1),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(111,78,30,0.08),transparent_28%),#050505]
        before:pointer-events-none before:fixed before:inset-0 before:content-['']
        before:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]
        before:bg-[size:58px_58px]
        before:[mask-image:radial-gradient(circle_at_center,black,transparent_78%)]
      "
    >
      <div
        className="
          pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px]
          rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]
        "
      />

      <div
        className="
          pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px]
          rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]
        "
      />

      <header
        className="
          relative z-[1] border-b border-white/[0.08]
          bg-[rgba(5,5,5,0.82)] backdrop-blur-[18px]
        "
      >
        <div
          className="
            mx-auto flex min-h-[66px] w-[calc(100vw-56px)] max-w-[1680px]
            items-center justify-between gap-6
            max-[1180px]:w-[min(100%,calc(100vw-40px))]
            max-[560px]:w-[min(100%,calc(100vw-28px))]
          "
        >
          <div className="flex min-w-0 items-center gap-3">
            <SunLogo />

            <div className="min-w-0">
              <p className="m-0 text-xs font-extrabold text-[#d6bf76]">
                SunGrid
              </p>

              <h1
                className="
                  m-0 mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap
                  text-xl font-extrabold tracking-[-0.035em] text-white
                  max-[560px]:text-[19px]
                "
              >
                {workspace.name}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div
        className="
          relative z-[1] mx-auto grid w-[calc(100vw-56px)] max-w-[1680px]
          grid-cols-[300px_minmax(0,1fr)] gap-6 py-7 pb-6
          max-[1180px]:w-[min(100%,calc(100vw-40px))]
          max-[1180px]:grid-cols-1 max-[1180px]:py-5
          max-[560px]:w-[min(100%,calc(100vw-28px))]
        "
      >
        <DashboardSidebar workspaceId={workspaceId} activePage="overview" />

        <section className="grid w-full min-w-0 max-w-full gap-4">
          <section
            className="
              flex items-end justify-between gap-[22px] rounded-[26px]
              border border-white/[0.08] bg-[rgba(12,12,12,0.92)]
              px-6 py-[22px]
              shadow-[0_24px_70px_rgba(0,0,0,0.28)]
              max-[820px]:flex-col max-[820px]:items-start
              max-[560px]:rounded-3xl max-[560px]:p-[22px]
            "
          >
            <div>
              <Kicker>Dashboard overview</Kicker>

              <h2
                className="
                  m-0 mt-2.5 max-w-[680px] text-[clamp(30px,3.4vw,38px)]
                  font-extrabold leading-none tracking-[-0.055em] text-white
                "
              >
                Welcome, {displayName}
              </h2>

              <p
                className="
                  m-0 mt-[13px] max-w-[600px] text-[15px]
                  leading-[1.6] text-white/[0.52]
                "
              >
                Track projects, issues, sprints, and recent activity from one
                focused place.
              </p>

              {isGuestWorkspace ? (
                <div
                  className="
                    mt-3.5 rounded-[18px] border border-[#d6bf76]/[0.14]
                    bg-[rgba(201,162,74,0.06)] px-[15px] py-3.5
                    text-sm leading-[1.6] text-white/[0.52]
                  "
                >
                  <strong className="font-extrabold text-[#f4e7b0]/[0.94]">
                    Sample workspace:
                  </strong>{" "}
                  This guest workspace includes sample projects, issues,
                  sprints, and activity so you can explore SunGrid without
                  setting up an account.
                </div>
              ) : null}
            </div>

            <div
              className="
                min-w-[140px] rounded-[20px] border border-white/[0.08]
                bg-[#050505] p-[15px]
                max-[820px]:w-full
              "
            >
              <span
                className="
                  block text-xs font-bold uppercase tracking-[0.12em]
                  text-white/[0.36]
                "
              >
                Your role
              </span>

              <strong className="mt-2 block text-[17px] text-[#d6bf76]">
                {roleLabel}
              </strong>
            </div>
          </section>

          <section
            className="
              grid grid-cols-4 gap-3.5
              max-[820px]:grid-cols-2
              max-[560px]:grid-cols-1
            "
          >
            <div
              className="
                min-w-0 rounded-[22px] border border-white/[0.08]
                bg-[rgba(12,12,12,0.92)] px-[18px] py-[17px]
                shadow-[0_24px_70px_rgba(0,0,0,0.28)]
              "
            >
              <p className="m-0 text-sm font-bold text-white/[0.42]">
                Members
              </p>
              <strong
                className="
                  mt-[9px] block text-[27px] font-extrabold leading-none
                  tracking-[-0.045em] text-white
                "
              >
                {memberCount}
              </strong>
            </div>

            <div
              className="
                min-w-0 rounded-[22px] border border-white/[0.08]
                bg-[rgba(12,12,12,0.92)] px-[18px] py-[17px]
                shadow-[0_24px_70px_rgba(0,0,0,0.28)]
              "
            >
              <p className="m-0 text-sm font-bold text-white/[0.42]">
                Active projects
              </p>
              <strong
                className="
                  mt-[9px] block text-[27px] font-extrabold leading-none
                  tracking-[-0.045em] text-white
                "
              >
                {activeProjectCount}
              </strong>
              <span className="mt-[7px] block text-xs text-white/[0.28]">
                {projectCount} total
              </span>
            </div>

            <div
              className="
                min-w-0 rounded-[22px] border border-white/[0.08]
                bg-[rgba(12,12,12,0.92)] px-[18px] py-[17px]
                shadow-[0_24px_70px_rgba(0,0,0,0.28)]
              "
            >
              <p className="m-0 text-sm font-bold text-white/[0.42]">Issues</p>
              <strong
                className="
                  mt-[9px] block text-[27px] font-extrabold leading-none
                  tracking-[-0.045em] text-white
                "
              >
                {issueCount}
              </strong>
            </div>

            <div
              className="
                min-w-0 rounded-[22px] border border-white/[0.08]
                bg-[rgba(12,12,12,0.92)] px-[18px] py-[17px]
                shadow-[0_24px_70px_rgba(0,0,0,0.28)]
              "
            >
              <p className="m-0 text-sm font-bold text-white/[0.42]">
                Completion
              </p>
              <strong
                className="
                  mt-[9px] block text-[27px] font-extrabold leading-none
                  tracking-[-0.045em] text-white
                "
              >
                {completionRate}%
              </strong>
              <span className="mt-[7px] block text-xs text-white/[0.28]">
                {completedIssueCount} done
              </span>
            </div>
          </section>

          <section
            className="
              grid grid-cols-[minmax(0,1fr)_360px] gap-[18px]
              max-[1180px]:grid-cols-1
            "
          >
            <div
              className="
                min-w-0 rounded-[26px] border border-white/[0.08]
                bg-[rgba(12,12,12,0.92)] px-[22px] py-[21px]
                shadow-[0_24px_70px_rgba(0,0,0,0.28)]
                max-[560px]:rounded-3xl max-[560px]:p-[22px]
              "
            >
              <div className="mb-[18px] flex items-start justify-between gap-[18px]">
                <div>
                  <Kicker>Workspace health</Kicker>

                  <h3
                    className="
                      m-0 mt-[7px] text-[21px] font-extrabold
                      tracking-[-0.04em] text-white
                    "
                  >
                    Current work
                  </h3>
                </div>

                <span
                  className="
                    rounded-full border border-green-500/[0.18]
                    bg-green-500/10 px-[11px] py-[7px]
                    text-xs font-extrabold text-[#86efac]
                  "
                >
                  Live
                </span>
              </div>

              <div
                className="
                  grid grid-cols-3 gap-3
                  max-[820px]:grid-cols-2
                  max-[560px]:grid-cols-1
                "
              >
                <div
                  className="
                    min-w-0 rounded-[18px] border border-white/[0.07]
                    bg-[#050505] p-3.5
                  "
                >
                  <p className="m-0 text-[13px] font-bold text-white/[0.38]">
                    Activity
                  </p>
                  <strong className="mt-2 block text-[23px] font-extrabold text-white">
                    {activityCount}
                  </strong>
                </div>

                <div
                  className="
                    min-w-0 rounded-[18px] border border-white/[0.07]
                    bg-[#050505] p-3.5
                  "
                >
                  <p className="m-0 text-[13px] font-bold text-white/[0.38]">
                    Open issues
                  </p>
                  <strong className="mt-2 block text-[23px] font-extrabold text-white">
                    {openIssueCount}
                  </strong>
                </div>

                <div
                  className="
                    min-w-0 rounded-[18px] border border-white/[0.07]
                    bg-[#050505] p-3.5
                  "
                >
                  <p className="m-0 text-[13px] font-bold text-white/[0.38]">
                    Completed
                  </p>
                  <strong className="mt-2 block text-[23px] font-extrabold text-white">
                    {completedIssueCount}
                  </strong>
                </div>
              </div>

              <div
                className="
                  mt-3.5 rounded-[18px] border border-[#d6bf76]/[0.14]
                  bg-[rgba(201,162,74,0.06)] px-[15px] py-3.5
                  text-sm leading-[1.6] text-white/[0.52]
                "
              >
                Recent project, issue, and sprint updates are tracked here so
                your team can stay aligned.
              </div>
            </div>

            <div
              className="
                min-w-0 rounded-[26px] border border-white/[0.08]
                bg-[rgba(12,12,12,0.92)] px-[22px] py-[21px]
                shadow-[0_24px_70px_rgba(0,0,0,0.28)]
                max-[560px]:rounded-3xl max-[560px]:p-[22px]
              "
            >
              <div className="mb-[18px] flex items-start justify-between gap-[18px]">
                <div>
                  <Kicker>Recent activity</Kicker>

                  <h3
                    className="
                      m-0 mt-[7px] text-[21px] font-extrabold
                      tracking-[-0.04em] text-white
                    "
                  >
                    Latest updates
                  </h3>
                </div>

                <Link
                  href={`/dashboard/${workspaceId}/activity`}
                  className="
                    inline-flex min-h-[42px] items-center rounded-full
                    border border-white/[0.08] px-4 text-[13px]
                    font-bold text-white/50 no-underline
                    transition-[transform,color,background,border-color]
                    duration-[160ms] ease-in-out
                    hover:-translate-y-px hover:border-white/[0.14]
                    hover:bg-white/[0.06] hover:text-white
                  "
                >
                  View all
                </Link>
              </div>

              <div className="grid gap-[11px]">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="
                        flex min-w-0 justify-between gap-3.5 rounded-[18px]
                        border border-white/[0.07] bg-[#050505]
                        px-[15px] py-3.5
                      "
                    >
                      <div>
                        <p className="m-0 text-sm font-bold text-white">
                          {formatActivityAction(activity.action)}
                        </p>

                        <span
                          className="
                            mt-1.5 block text-[13px] leading-[1.45]
                            text-white/[0.38]
                          "
                        >
                          {activity.description}
                        </span>
                      </div>

                      <time className="whitespace-nowrap text-xs text-white/[0.28]">
                        {formatDate(activity.createdAt)}
                      </time>
                    </div>
                  ))
                ) : (
                  <div
                    className="
                      min-w-0 rounded-[18px] border border-white/[0.07]
                      bg-[#050505] px-[15px] py-3.5
                    "
                  >
                    <p className="m-0 text-sm font-bold text-white/[0.62]">
                      No activity yet.
                    </p>

                    <span className="mt-2 block text-[13px] text-white/[0.36]">
                      Project and issue updates will appear here.
                    </span>
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

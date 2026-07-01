import Link from "next/link";

const projects = [
  {
    name: "Website Redesign",
    description: "Landing page, auth flow, and dashboard polish.",
    status: "Active",
    issues: 18,
    completed: 12,
    priority: "High",
  },
  {
    name: "Mobile App Launch",
    description: "Sprint planning, issue tracking, and release tasks.",
    status: "Active",
    issues: 26,
    completed: 15,
    priority: "Urgent",
  },
  {
    name: "Internal Tools",
    description: "Admin workflow improvements and reporting.",
    status: "Planning",
    issues: 11,
    completed: 4,
    priority: "Medium",
  },
];

const board = {
  Backlog: [
    { title: "Create invite acceptance flow", type: "FEATURE", points: 5 },
    { title: "Add billing feature gates", type: "TASK", points: 3 },
  ],
  "In Progress": [
    { title: "Build sprint analytics cards", type: "STORY", points: 8 },
    { title: "Improve board mobile layout", type: "BUG", points: 3 },
  ],
  Review: [
    { title: "Audit workspace permissions", type: "TASK", points: 3 },
  ],
  Done: [
    { title: "Project detail page", type: "FEATURE", points: 5 },
    { title: "Drag-and-drop Kanban board", type: "STORY", points: 8 },
  ],
};

const activity = [
  {
    action: "issue.moved",
    text: "Moved “Build sprint analytics cards” to In Progress",
    time: "2 min ago",
  },
  {
    action: "sprint.started",
    text: "Started Sprint 12 for Mobile App Launch",
    time: "18 min ago",
  },
  {
    action: "comment.created",
    text: "Added QA feedback on board mobile layout",
    time: "42 min ago",
  },
  {
    action: "project.created",
    text: "Created Internal Tools project",
    time: "1 hr ago",
  },
];

const features = [
  "Clerk authentication",
  "Workspace-based multi-tenancy",
  "OWNER / ADMIN / MEMBER roles",
  "Project and issue management",
  "Kanban workflow",
  "Sprint planning",
  "Activity audit logs",
  "Prisma + PostgreSQL persistence",
];

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

const sidebarClass =
  "sticky top-7 h-[calc(100vh-56px)] overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.2)] max-[1180px]:static max-[1180px]:h-auto";

const contentClass = "grid w-full min-w-0 max-w-full gap-3 overflow-hidden";

const heroCardClass =
  "rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3.5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";

const cardClass =
  "rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";

const sectionHeaderClass =
  "rounded-[1.2rem] border border-white/[0.08] bg-white/[0.025] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const metricCardClass =
  "min-w-0 rounded-[1.1rem] border border-white/10 bg-white/[0.035] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const panelCardClass =
  "rounded-[1.2rem] border border-white/10 bg-black/30 p-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition hover:border-[#d6bf76]/15 hover:bg-white/[0.035]";

const badgeClass =
  "rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-white/55";

const primaryButtonClass =
  "inline-flex h-9 items-center justify-center rounded-full border border-[#d6bf76]/25 bg-[#d6bf76]/[0.12] px-4 text-sm font-extrabold text-[#f4e7b0] no-underline transition hover:-translate-y-px hover:bg-[#d6bf76]/[0.18] hover:text-white active:translate-y-0 active:scale-[0.98]";

const secondaryButtonClass =
  "inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-black/30 px-4 text-sm font-bold text-white/55 no-underline transition hover:-translate-y-px hover:bg-white/[0.05] hover:text-white active:translate-y-0 active:scale-[0.98]";

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

function SunGridLogo() {
  return (
    <div
      className="grid h-11 w-11 shrink-0 place-items-center rounded-[1.1rem] border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] shadow-[0_14px_36px_rgba(0,0,0,0.18)]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80" className="h-8 w-8">
        <defs>
          <linearGradient id="guestSunGradient" x1="16" y1="10" x2="66" y2="70">
            <stop offset="0%" stopColor="#fff7ad" />
            <stop offset="45%" stopColor="#d6bf76" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        <path
          d="M40 7V17M40 63V73M7 40H17M63 40H73M16.5 16.5L23.5 23.5M56.5 56.5L63.5 63.5M63.5 16.5L56.5 23.5M23.5 56.5L16.5 63.5"
          stroke="#f4e7b0"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <circle cx="40" cy="40" r="22" fill="url(#guestSunGradient)" />

        <path
          d="M29 35H51M29 45H51M35 29V51M45 29V51"
          stroke="#111827"
          strokeWidth="2.7"
          strokeLinecap="round"
          opacity="0.72"
        />
      </svg>
    </div>
  );
}

function IssueCard({
  title,
  type,
  points,
}: {
  title: string;
  type: string;
  points: number;
}) {
  return (
    <div className="rounded-[1rem] border border-white/10 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <p className="m-0 break-words text-sm font-extrabold leading-5 text-white">
        {title}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className={badgeClass}>{type}</span>
        <span className={badgeClass}>{points} pts</span>
      </div>
    </div>
  );
}

export default function GuestPage() {
  const totalIssues = projects.reduce((sum, project) => sum + project.issues, 0);
  const totalCompleted = projects.reduce(
    (sum, project) => sum + project.completed,
    0,
  );
  const sprintProgress = Math.round((totalCompleted / totalIssues) * 100);

  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <div className={shellClass}>
        <aside className={sidebarClass}>
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 no-underline"
          >
            <SunGridLogo />

            <span className="truncate text-lg font-extrabold tracking-[-0.04em] text-white">
              SunGrid
            </span>
          </Link>

          <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-black/30 p-3.5">
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
              Guest Workspace
            </p>

            <strong className="mt-1.5 block truncate text-sm font-extrabold text-white">
              Product Team
            </strong>

            <span className="mt-1 block text-xs text-white/35">
              Read-only preview
            </span>
          </div>

          <nav className="mt-4 grid gap-1.5">
            {[
              "Overview",
              "Projects",
              "Issues",
              "Board",
              "Sprints",
              "Activity",
              "Analytics",
              "Members",
            ].map((item, index) => (
              <span
                key={item}
                className={
                  index === 0
                    ? "rounded-full border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] px-3 py-2 text-sm font-extrabold text-[#f4e7b0]"
                    : "rounded-full border border-transparent px-3 py-2 text-sm font-bold text-white/45"
                }
              >
                {item}
              </span>
            ))}
          </nav>

          <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3.5">
            <strong className="block text-sm font-extrabold text-white">
              What is this?
            </strong>

            <p className="m-0 mt-1.5 text-sm leading-6 text-white/45">
              A read-only workspace that shows how SunGrid works without asking
              visitors to create an account.
            </p>
          </div>
        </aside>

        <section className={contentClass}>
          <header className={heroCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
                  Guest / Product Team
                </p>

                <h1 className="m-0 mt-1 truncate text-[25px] font-extrabold tracking-[-0.04em] text-white md:text-[28px]">
                  Workspace Overview
                </h1>

                <p className="m-0 mt-1 max-w-3xl break-words text-sm text-white/45">
                  See how SunGrid manages real team work across projects,
                  issues, boards, sprints, members, and activity.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href="/" className={secondaryButtonClass}>
                  Home
                </Link>

                <Link href="/sign-in" className={primaryButtonClass}>
                  Sign in
                </Link>
              </div>
            </div>
          </header>

          <section className={cardClass}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] px-2.5 py-1 text-xs font-extrabold text-[#f4e7b0]">
                  Read-only guest view
                </span>

                <h2 className="m-0 mt-3 max-w-3xl text-[25px] font-extrabold tracking-[-0.04em] text-white md:text-[28px]">
                  See how SunGrid manages real team work.
                </h2>

                <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-white/45">
                  SunGrid is a multi-tenant project management SaaS where teams
                  organize workspaces, projects, issues, Kanban boards, sprints,
                  members, and activity history.
                </p>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-black/30 p-3.5">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
                  Core data flow
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {["User", "Workspace", "Project", "Issue", "Sprint"].map(
                    (item) => (
                      <span key={item} className={badgeClass}>
                        {item}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            {[
              {
                label: "Projects",
                value: projects.length,
                detail: "Workspace-scoped",
              },
              {
                label: "Issues",
                value: totalIssues,
                detail: "Tasks, bugs, stories",
              },
              {
                label: "Sprint Progress",
                value: `${sprintProgress}%`,
                detail: "Active sprint",
              },
              {
                label: "Roles",
                value: 3,
                detail: "Owner, Admin, Member",
              },
            ].map((metric) => (
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

          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className={cardClass}>
              <div className={sectionHeaderClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                      Projects
                    </p>

                    <h3 className="m-0 mt-1.5 text-lg font-extrabold text-white">
                      Workspace projects
                    </h3>
                  </div>

                  <span className={badgeClass}>Protected by RBAC</span>
                </div>
              </div>

              <div className="mt-3 grid gap-3">
                {projects.map((project) => {
                  const completion = Math.round(
                    (project.completed / project.issues) * 100,
                  );

                  return (
                    <article key={project.name} className={panelCardClass}>
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px]">
                        <div className="min-w-0">
                          <h4 className="m-0 truncate text-sm font-extrabold text-white">
                            {project.name}
                          </h4>

                          <p className="m-0 mt-1.5 break-words text-sm leading-6 text-white/45">
                            {project.description}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className={badgeClass}>{project.status}</span>
                            <span className={badgeClass}>
                              {project.priority}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-[1.1rem] border border-white/10 bg-black/25 p-3">
                          <strong className="block text-sm font-extrabold text-white">
                            {project.completed}/{project.issues}
                          </strong>

                          <p className="m-0 mt-1 text-xs text-white/35">
                            issues done
                          </p>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                            <div
                              className="h-full rounded-full bg-[#d6bf76]"
                              style={{
                                width: `${completion}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className={cardClass}>
              <div className={sectionHeaderClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                      Sprint
                    </p>

                    <h3 className="m-0 mt-1.5 text-lg font-extrabold text-white">
                      Sprint 12
                    </h3>
                  </div>

                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-extrabold text-emerald-200">
                    Active
                  </span>
                </div>
              </div>

              <div className="mx-auto mt-4 grid h-32 w-32 place-items-center rounded-full border border-[#d6bf76]/20 bg-[#d6bf76]/[0.08] shadow-[inset_0_0_40px_rgba(214,191,118,0.08)]">
                <span className="text-3xl font-extrabold tracking-[-0.05em] text-[#f4e7b0]">
                  68%
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { value: 34, label: "Total pts" },
                  { value: 23, label: "Done pts" },
                  { value: 11, label: "Left" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[1rem] border border-white/10 bg-black/30 p-3 text-center"
                  >
                    <strong className="block text-lg font-extrabold text-white">
                      {stat.value}
                    </strong>

                    <span className="mt-1 block text-xs text-white/35">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <div className={sectionHeaderClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                    Kanban Board
                  </p>

                  <h3 className="m-0 mt-1.5 text-lg font-extrabold text-white">
                    Issue workflow
                  </h3>
                </div>

                <span className={badgeClass}>Drag-and-drop in real app</span>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto pb-1">
              <div className="grid min-w-[920px] grid-cols-4 gap-3 xl:min-w-0">
                {Object.entries(board).map(([column, issues]) => (
                  <div
                    key={column}
                    className="rounded-[1.1rem] border border-white/10 bg-black/30 p-3.5"
                  >
                    <h4 className="m-0 mb-3 truncate text-sm font-extrabold text-white">
                      {column}
                    </h4>

                    <div className="grid gap-2">
                      {issues.map((issue) => (
                        <IssueCard key={issue.title} {...issue} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <div className={cardClass}>
              <div className={sectionHeaderClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                      Activity
                    </p>

                    <h3 className="m-0 mt-1.5 text-lg font-extrabold text-white">
                      Audit trail
                    </h3>
                  </div>

                  <span className={badgeClass}>Logged actions</span>
                </div>
              </div>

              <div className="mt-3 grid gap-3">
                {activity.map((item) => (
                  <article key={item.text} className={panelCardClass}>
                    <div className="flex gap-3">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#d6bf76]" />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <strong className="break-words text-sm font-extrabold text-white">
                            {item.action}
                          </strong>

                          <span className="text-xs font-bold text-white/35">
                            {item.time}
                          </span>
                        </div>

                        <p className="m-0 mt-1 break-words text-sm leading-5 text-white/45">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className={cardClass}>
              <div className={sectionHeaderClass}>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                  Architecture
                </p>

                <h3 className="m-0 mt-1.5 text-lg font-extrabold text-white">
                  What this project demonstrates
                </h3>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 rounded-[1rem] border border-white/10 bg-black/30 px-3.5 py-3"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#d6bf76]" />

                    <p className="m-0 break-words text-sm font-bold text-white/55">
                      {feature}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={heroCardClass}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h3 className="m-0 text-lg font-extrabold text-white">
                  This guest workspace is read-only.
                </h3>

                <p className="m-0 mt-1 max-w-3xl break-words text-sm leading-6 text-white/45">
                  The real app saves data to PostgreSQL, protects workspace
                  routes with Clerk and RBAC, and shows different data based on
                  the logged-in user’s workspace membership.
                </p>
              </div>

              <Link href="/sign-up" className={primaryButtonClass}>
                Create account
              </Link>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
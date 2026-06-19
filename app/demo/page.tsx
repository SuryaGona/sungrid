import Link from "next/link";
import styles from "./demo.module.css";

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

function SunGridLogo() {
  return (
    <div className={styles.logoWrap} aria-hidden="true">
      <svg viewBox="0 0 80 80" className={styles.logo}>
        <defs>
          <linearGradient id="guestSunGradient" x1="16" y1="10" x2="66" y2="70">
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
    <div className={styles.issueCard}>
      <p>{title}</p>
      <div>
        <span>{type}</span>
        <span>{points} pts</span>
      </div>
    </div>
  );
}

export default function GuestPage() {
  return (
    <main className={styles.page}>
      <div className={styles.glowOne} />
      <div className={styles.glowTwo} />

      <div className={styles.appShell}>
        <aside className={styles.sidebar}>
          <Link href="/" className={styles.brand}>
            <SunGridLogo />
            <span>SunGrid</span>
          </Link>

          <div className={styles.workspaceCard}>
            <p>Guest Workspace</p>
            <strong>Product Team</strong>
            <span>Read-only preview</span>
          </div>

          <nav className={styles.navList}>
            <a className={styles.navItemActive}>Overview</a>
            <a className={styles.navItem}>Projects</a>
            <a className={styles.navItem}>Issues</a>
            <a className={styles.navItem}>Board</a>
            <a className={styles.navItem}>Sprints</a>
            <a className={styles.navItem}>Activity</a>
            <a className={styles.navItem}>Analytics</a>
            <a className={styles.navItem}>Members</a>
          </nav>

          <div className={styles.sidebarNote}>
            <strong>What is this?</strong>
            <p>
              A read-only workspace that shows how SunGrid works without asking
              visitors to create an account.
            </p>
          </div>
        </aside>

        <section className={styles.main}>
          <header className={styles.topbar}>
            <div>
              <p className={styles.breadcrumb}>Guest / Product Team</p>
              <h1>Workspace Overview</h1>
            </div>

            <div className={styles.topActions}>
              <Link href="/" className={styles.secondaryButton}>
                Home
              </Link>
              <Link href="/sign-in" className={styles.primaryButton}>
                Sign In
              </Link>
            </div>
          </header>

          <section className={styles.heroPanel}>
            <div>
              <span className={styles.readOnlyPill}>Read-only guest view</span>
              <h2>See how SunGrid manages real team work.</h2>
              <p>
                SunGrid is a multi-tenant project management SaaS where teams
                organize workspaces, projects, issues, Kanban boards, sprints,
                members, and activity history.
              </p>
            </div>

            <div className={styles.flowCard}>
              <p>Core data flow</p>
              <div className={styles.flowSteps}>
                <span>User</span>
                <span>Workspace</span>
                <span>Project</span>
                <span>Issue</span>
                <span>Sprint</span>
              </div>
            </div>
          </section>

          <section className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <p>Projects</p>
              <strong>3</strong>
              <span>Workspace-scoped</span>
            </div>
            <div className={styles.metricCard}>
              <p>Issues</p>
              <strong>55</strong>
              <span>Tasks, bugs, stories</span>
            </div>
            <div className={styles.metricCard}>
              <p>Sprint Progress</p>
              <strong>68%</strong>
              <span>Active sprint</span>
            </div>
            <div className={styles.metricCard}>
              <p>Roles</p>
              <strong>3</strong>
              <span>Owner, Admin, Member</span>
            </div>
          </section>

          <section className={styles.contentGrid}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>Projects</p>
                  <h3>Workspace projects</h3>
                </div>
                <span className={styles.smallPill}>Protected by RBAC</span>
              </div>

              <div className={styles.projectList}>
                {projects.map((project) => (
                  <div key={project.name} className={styles.projectRow}>
                    <div className={styles.projectInfo}>
                      <h4>{project.name}</h4>
                      <p>{project.description}</p>
                      <div className={styles.projectTags}>
                        <span>{project.status}</span>
                        <span>{project.priority}</span>
                      </div>
                    </div>

                    <div className={styles.projectProgress}>
                      <strong>
                        {project.completed}/{project.issues}
                      </strong>
                      <p>issues done</p>
                      <div className={styles.progressTrack}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${Math.round(
                              (project.completed / project.issues) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>Sprint</p>
                  <h3>Sprint 12</h3>
                </div>
                <span className={styles.greenPill}>Active</span>
              </div>

              <div className={styles.sprintCircle}>
                <span>68%</span>
              </div>

              <div className={styles.sprintStats}>
                <div>
                  <strong>34</strong>
                  <span>Total pts</span>
                </div>
                <div>
                  <strong>23</strong>
                  <span>Done pts</span>
                </div>
                <div>
                  <strong>11</strong>
                  <span>Left</span>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.boardPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Kanban Board</p>
                <h3>Issue workflow</h3>
              </div>
              <span className={styles.smallPill}>
                Drag-and-drop in real app
              </span>
            </div>

            <div className={styles.boardGrid}>
              {Object.entries(board).map(([column, issues]) => (
                <div key={column} className={styles.boardColumn}>
                  <h4>{column}</h4>

                  {issues.map((issue) => (
                    <IssueCard key={issue.title} {...issue} />
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className={styles.bottomGrid}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>Activity</p>
                  <h3>Audit trail</h3>
                </div>
                <span className={styles.smallPill}>Logged actions</span>
              </div>

              <div className={styles.activityList}>
                {activity.map((item) => (
                  <div key={item.text} className={styles.activityItem}>
                    <div className={styles.activityDot} />
                    <div>
                      <strong>{item.action}</strong>
                      <p>{item.text}</p>
                    </div>
                    <span>{item.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>Architecture</p>
                  <h3>What this project demonstrates</h3>
                </div>
              </div>

              <div className={styles.featureGrid}>
                {features.map((feature) => (
                  <div key={feature} className={styles.featureItem}>
                    <span />
                    <p>{feature}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.finalCta}>
            <div>
              <h3>This guest workspace is read-only.</h3>
              <p>
                The real app saves data to PostgreSQL, protects workspace routes
                with Clerk and RBAC, and shows different data based on the
                logged-in user’s workspace membership.
              </p>
            </div>

            <Link href="/sign-up" className={styles.primaryButton}>
              Create Account
            </Link>
          </section>
        </section>
      </div>
    </main>
  );
}
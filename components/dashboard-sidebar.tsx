import Link from "next/link";
import styles from "./dashboard-sidebar.module.css";

type DashboardSidebarProps = {
  workspaceId: string;
  activePage:
    | "overview"
    | "projects"
    | "analytics"
    | "members"
    | "activity"
    | "settings";
};

const navItems = [
  {
    label: "Overview",
    value: "overview",
    href: "",
    description: "Workspace home",
  },
  {
    label: "Projects",
    value: "projects",
    href: "/projects",
    description: "Work and delivery",
  },
  {
    label: "Analytics",
    value: "analytics",
    href: "/analytics",
    description: "Metrics and reports",
  },
  {
    label: "Members",
    value: "members",
    href: "/members",
    description: "Team and roles",
  },
  {
    label: "Activity",
    value: "activity",
    href: "/activity",
    description: "Audit trail",
  },
  {
    label: "Settings",
    value: "settings",
    href: "/settings",
    description: "Workspace config",
  },
] as const;

export function DashboardSidebar({
  workspaceId,
  activePage,
}: DashboardSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <p>SunGrid</p>
        <span>Workspace operations</span>
      </div>

      <nav className={styles.nav} aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const href = `/dashboard/${workspaceId}${item.href}`;
          const isActive = activePage === item.value;

          return (
            <Link
              key={item.value}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={isActive ? styles.navItemActive : styles.navItem}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <p>SunGrid Core</p>
        <span>Auth · RBAC · Projects · Issues · Sprints · Reports</span>
      </div>
    </aside>
  );
}
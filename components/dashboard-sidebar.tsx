import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { prisma } from "@/lib/db";
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
  isGuestWorkspace?: boolean;
};

const navItems = [
  {
    label: "Overview",
    value: "overview",
    href: "",
    description: "Dashboard home",
  },
  {
    label: "Projects",
    value: "projects",
    href: "/projects",
    description: "Projects and issues",
  },
  {
    label: "Analytics",
    value: "analytics",
    href: "/analytics",
    description: "Progress insights",
  },
  {
    label: "Members",
    value: "members",
    href: "/members",
    description: "Team access",
  },
  {
    label: "Activity",
    value: "activity",
    href: "/activity",
    description: "Latest updates",
  },
  {
    label: "Settings",
    value: "settings",
    href: "/settings",
    description: "Workspace settings",
  },
] as const;

async function getIsGuestWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
    select: {
      isGuest: true,
    },
  });

  return Boolean(workspace?.isGuest);
}

export async function DashboardSidebar({
  workspaceId,
  activePage,
  isGuestWorkspace,
}: DashboardSidebarProps) {
  const resolvedIsGuestWorkspace =
    isGuestWorkspace ?? (await getIsGuestWorkspace(workspaceId));

  return (
    <aside className={styles.sidebar}>
      <div className="flex items-start justify-between gap-4">
        <div className={styles.sidebarHeader}>
          <p>SunGrid</p>
          <span>
            {resolvedIsGuestWorkspace ? "Guest demo" : "Team workspace"}
          </span>
        </div>

        {resolvedIsGuestWorkspace ? (
          <Link
            href="/sign-up"
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-amber-200 transition hover:bg-amber-300 hover:text-black"
          >
            ← Create account
          </Link>
        ) : (
          <UserButton
            fallbackRedirectUrl="/"
            appearance={{
              elements: {
                userButtonAvatarBox:
                  "h-9 w-9 rounded-full ring-1 ring-white/10 shadow-lg shadow-black/25",
              },
            }}
          />
        )}
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
        <p>Workspace</p>
        <span>Projects, sprints, and team activity.</span>
      </div>
    </aside>
  );
}
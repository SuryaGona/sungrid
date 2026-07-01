import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { prisma } from "@/lib/db";

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
    <aside
      className="
        sticky top-6 h-fit overflow-hidden rounded-3xl
        border border-white/[0.08]
        bg-[radial-gradient(circle_at_top_left,rgba(201,162,74,0.1),transparent_34%),rgba(12,12,12,0.94)]
        p-[14px]
        shadow-[0_24px_70px_rgba(0,0,0,0.28)]
        max-[980px]:static
      "
    >
      <div className="flex items-start justify-between gap-3">
        <div className="px-2.5 pb-[18px] pl-3.5 pt-3.5">
          <p className="m-0 text-xs font-extrabold uppercase tracking-[0.12em] text-[#d6bf76]">
            SunGrid
          </p>

          <span className="mt-[7px] block text-[13px] leading-[1.5] text-white/[0.48]">
            {resolvedIsGuestWorkspace ? "Guest demo" : "Team workspace"}
          </span>
        </div>

        {resolvedIsGuestWorkspace ? (
          <Link
            href="/sign-up"
            className="
              mt-[9px] shrink-0 rounded-full
              border border-[#d6bf76]/20
              bg-[#d6bf76]/[0.09]
              px-3 py-2
              text-xs font-[750] leading-none text-[#e8d28a]
              no-underline
              transition-[transform,background,border-color,color]
              duration-160 ease-in-out
              hover:-translate-y-px
              hover:border-[#d6bf76]/30
              hover:bg-[#d6bf76]/[0.14]
              hover:text-[#fff4c2]
            "
          >
            ← Create account
          </Link>
        ) : (
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox:
                  "h-9 w-9 rounded-full ring-1 ring-white/10 shadow-lg shadow-black/25",
              },
            }}
          />
        )}
      </div>

      <nav
        className="
          grid gap-[7px]
          max-[980px]:grid-cols-3
          max-[640px]:grid-cols-2
        "
        aria-label="Dashboard navigation"
      >
        {navItems.map((item) => {
          const href = `/dashboard/${workspaceId}${item.href}`;
          const isActive = activePage === item.value;

          return (
            <Link
              key={item.value}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? `
                    flex min-h-14 flex-col items-start justify-center gap-1
                    rounded-2xl
                    border border-[#d6bf76]/[0.24]
                    bg-[linear-gradient(135deg,rgba(201,162,74,0.15),rgba(111,78,30,0.12)),rgba(255,255,255,0.05)]
                    px-3.5 py-2.5
                    text-[#f4e7b0] no-underline
                    shadow-[0_14px_34px_rgba(0,0,0,0.18)]
                    transition-[background,color,transform,border-color,box-shadow]
                    duration-160 ease-in-out
                    max-[980px]:min-h-16
                    max-[980px]:items-center
                    max-[980px]:text-center
                  `
                  : `
                    group flex min-h-14 flex-col items-start justify-center gap-1
                    rounded-2xl
                    border border-transparent
                    px-3.5 py-2.5
                    text-white/[0.62] no-underline
                    transition-[background,color,transform,border-color,box-shadow]
                    duration-160 ease-in-out
                    hover:-translate-y-px
                    hover:border-white/[0.08]
                    hover:bg-white/[0.06]
                    hover:text-white
                    max-[980px]:min-h-16
                    max-[980px]:items-center
                    max-[980px]:text-center
                  `
              }
            >
              <span className="text-sm font-bold leading-[1.1]">
                {item.label}
              </span>

              <small
                className={
                  isActive
                    ? "text-[11px] font-medium leading-[1.25] text-white/[0.52]"
                    : "text-[11px] font-medium leading-[1.25] text-white/[0.34] group-hover:text-white/[0.54]"
                }
              >
                {item.description}
              </small>
            </Link>
          );
        })}
      </nav>

      <div
        className="
          mt-4 rounded-[18px]
          border border-white/[0.08]
          bg-white/[0.04]
          p-3.5
          max-[640px]:hidden
        "
      >
        <p className="m-0 text-[13px] font-bold text-white/[0.82]">
          Workspace
        </p>

        <span className="mt-1.5 block text-xs leading-[1.5] text-white/[0.42]">
          Projects, sprints, and team activity.
        </span>
      </div>
    </aside>
  );
}

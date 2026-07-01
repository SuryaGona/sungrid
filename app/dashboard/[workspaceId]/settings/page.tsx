import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/workspace-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SettingsPageProps = {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

const updateWorkspaceSchema = z.object({
  workspaceId: z.string().min(1),
  workspaceName: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters.")
    .max(80, "Workspace name must be 80 characters or less."),
  workspaceDescription: z
    .string()
    .trim()
    .max(300, "Workspace description must be 300 characters or less.")
    .optional(),
});

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

const contentClass = "grid w-full min-w-0 max-w-full gap-3 overflow-hidden";

const heroCardClass =
  "rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3.5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";

const cardClass =
  "rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";

const sectionHeaderClass =
  "rounded-[1.2rem] border border-white/[0.08] bg-white/[0.025] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const metricCardClass =
  "min-w-0 rounded-[1.1rem] border border-white/10 bg-white/[0.035] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const innerCardClass =
  "rounded-[1.1rem] border border-white/10 bg-black/30 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]";

const protectedCardClass =
  "rounded-[1.2rem] border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.16)]";

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d6bf76]/60";

const textAreaClass =
  "mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/30 focus:border-[#d6bf76]/60";

const slugBoxClass =
  "mt-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white/45";

const primaryButtonClass =
  "w-fit rounded-full border border-[#d6bf76]/25 bg-[#d6bf76]/[0.12] px-4 py-2 text-sm font-extrabold text-[#f4e7b0] transition hover:-translate-y-px hover:bg-[#d6bf76]/[0.18] hover:text-white active:translate-y-0 active:scale-[0.98]";

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

function settingsPageUrl(workspaceId: string, params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();

  if (!query) {
    return `/dashboard/${workspaceId}/settings`;
  }

  return `/dashboard/${workspaceId}/settings?${query}`;
}

function getMessage(value: string | undefined) {
  if (!value) {
    return null;
  }

  const messages: Record<string, string> = {
    "invalid-workspace":
      "Workspace name must be 2-80 characters. Description must be 300 characters or less.",
    "workspace-not-found": "Workspace not found.",
    "workspace-updated": "Workspace settings updated successfully.",
    database: "SunGrid could not update workspace settings.",
  };

  return messages[value] ?? null;
}

function createSlug(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return slug || "workspace";
}

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

async function getUniqueWorkspaceSlug(
  workspaceId: string,
  workspaceName: string,
) {
  const baseSlug = createSlug(workspaceName);
  let slug = baseSlug;
  let counter = 2;

  while (
    await prisma.workspace.findFirst({
      where: {
        slug,
        NOT: {
          id: workspaceId,
        },
      },
      select: {
        id: true,
      },
    })
  ) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

async function updateWorkspace(formData: FormData) {
  "use server";

  const workspaceId = String(formData.get("workspaceId") || "");

  if (!workspaceId) {
    redirect("/dashboard");
  }

  const parsed = updateWorkspaceSchema.safeParse({
    workspaceId,
    workspaceName: formData.get("workspaceName"),
    workspaceDescription: formData.get("workspaceDescription"),
  });

  if (!parsed.success) {
    redirect(
      settingsPageUrl(workspaceId, {
        error: "invalid-workspace",
      }),
    );
  }

  const { workspaceName, workspaceDescription } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER"]);

  const oldWorkspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
    },
  });

  if (!oldWorkspace) {
    redirect(
      settingsPageUrl(workspaceId, {
        error: "workspace-not-found",
      }),
    );
  }

  const slug = await getUniqueWorkspaceSlug(workspaceId, workspaceName);
  const description = workspaceDescription || null;

  try {
    await prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        name: workspaceName,
        slug,
        description,
      },
    });

    await logActivity({
      workspaceId,
      userId: user.id,
      action: "workspace.updated",
      description: `Updated workspace settings for "${workspaceName}".`,
      metadata: {
        oldName: oldWorkspace.name,
        newName: workspaceName,
        oldSlug: oldWorkspace.slug,
        newSlug: slug,
        oldDescription: oldWorkspace.description,
        newDescription: description,
      },
    });
  } catch (error) {
    console.error("Workspace settings update failed:", error);

    redirect(
      settingsPageUrl(workspaceId, {
        error: "database",
      }),
    );
  }

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/settings`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(
    settingsPageUrl(workspaceId, {
      success: "workspace-updated",
    }),
  );
}

export default async function SettingsPage({
  params,
  searchParams,
}: SettingsPageProps) {
  const { workspaceId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const errorMessage = getMessage(resolvedSearchParams.error);
  const successMessage = getMessage(resolvedSearchParams.success);

  const { workspace, user, membership } = await requireWorkspaceRole(
    workspaceId,
    ["OWNER"],
  );

  const isGuestWorkspace = Boolean(user.isGuest || workspace.isGuest);
  const roleLabel = isGuestWorkspace ? "Guest" : formatRole(membership.role);

  const roleHelper = isGuestWorkspace
    ? "Demo workspace access"
    : "Full workspace control";

  const accessLevelText = isGuestWorkspace
    ? "Guest demo access lets you explore this sample workspace while owner permissions stay protected behind the scenes."
    : "Can manage workspace settings, members, projects, issues, sprints, reports, and audit records.";

  const [memberCount, projectCount, activeProjectCount, activityCount] =
    await Promise.all([
      prisma.membership.count({
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

      prisma.activityLog.count({
        where: {
          workspaceId,
        },
      }),
    ]);

  const metrics = [
    {
      label: "Your role",
      value: roleLabel,
      helper: roleHelper,
    },
    {
      label: "Members",
      value: memberCount,
      helper: "Workspace access",
    },
    {
      label: "Projects",
      value: projectCount,
      helper: `${activeProjectCount} active`,
    },
    {
      label: "Audit events",
      value: activityCount,
      helper: "Recorded actions",
    },
  ];

  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <div className={shellClass}>
        <DashboardSidebar workspaceId={workspaceId} activePage="settings" />

        <section className={contentClass}>
          <header className={heroCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
                  Workspace control center
                </p>

                <h1 className="m-0 mt-1 truncate text-[25px] font-extrabold tracking-[-0.04em] text-white md:text-[28px]">
                  Settings
                </h1>

                <p className="m-0 mt-1 max-w-3xl truncate text-sm text-white/45">
                  Manage workspace identity, ownership, and configuration.
                </p>
              </div>

              <div className="flex min-w-0 flex-wrap justify-end gap-2">
                <span className="max-w-[220px] truncate rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-xs font-bold text-white/50">
                  {workspace.name}
                </span>

                <span className="rounded-full border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] px-2.5 py-1 text-xs font-extrabold text-[#f4e7b0]">
                  {isGuestWorkspace ? "Guest demo" : "Owner only"}
                </span>
              </div>
            </div>
          </header>

          {errorMessage ? (
            <div className="rounded-[1.2rem] border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
              {successMessage}
            </div>
          ) : null}

          <section className="grid gap-3 md:grid-cols-4">
            {metrics.map((stat) => (
              <div key={stat.label} className={metricCardClass}>
                <p className="m-0 truncate text-xs font-bold text-white/45">
                  {stat.label}
                </p>

                <strong className="mt-1.5 block truncate text-xl font-extrabold tracking-[-0.04em] text-white">
                  {stat.value}
                </strong>

                <span className="mt-1 block truncate text-xs text-white/35">
                  {stat.helper}
                </span>
              </div>
            ))}
          </section>

          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className={cardClass}>
              <div className={sectionHeaderClass}>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                  Workspace identity
                </p>

                <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                  Workspace details
                </h2>
              </div>

              <p className="m-0 mt-3 text-sm leading-6 text-white/45">
                These values define how the workspace appears across the
                dashboard. The slug is generated from the name and kept unique.
              </p>

              <form action={updateWorkspace} className="mt-4 grid gap-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />

                <div>
                  <label
                    htmlFor="workspaceName"
                    className="block text-sm font-bold text-white/70"
                  >
                    Workspace name
                  </label>

                  <input
                    id="workspaceName"
                    name="workspaceName"
                    type="text"
                    defaultValue={workspace.name}
                    required
                    minLength={2}
                    maxLength={80}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="workspaceDescription"
                    className="block text-sm font-bold text-white/70"
                  >
                    Workspace description
                  </label>

                  <textarea
                    id="workspaceDescription"
                    name="workspaceDescription"
                    rows={3}
                    maxLength={300}
                    defaultValue={workspace.description || ""}
                    placeholder="Example: Product delivery workspace for planning, tracking, and sprint reports."
                    className={textAreaClass}
                  />
                </div>

                <div>
                  <p className="m-0 text-sm font-bold text-white/70">
                    Current slug
                  </p>

                  <p className={slugBoxClass}>
                    {workspace.slug || "No slug yet"}
                  </p>
                </div>

                <button type="submit" className={primaryButtonClass}>
                  Save workspace
                </button>
              </form>
            </div>

            <div className="grid gap-3">
              <section className={cardClass}>
                <div className={sectionHeaderClass}>
                  <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                    Signed in
                  </p>

                  <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                    Account access
                  </h2>
                </div>

                <div className="mt-3 grid gap-3">
                  <div className={innerCardClass}>
                    <p className="m-0 text-xs font-bold text-white/45">
                      Email
                    </p>

                    <p className="m-0 mt-1.5 break-words text-sm font-bold text-white/70">
                      {user.email}
                    </p>
                  </div>

                  <div className={innerCardClass}>
                    <p className="m-0 text-xs font-bold text-white/45">Role</p>

                    <p className="m-0 mt-1.5 text-sm font-bold text-white/70">
                      {roleLabel}
                    </p>
                  </div>

                  <div className={innerCardClass}>
                    <p className="m-0 text-xs font-bold text-white/45">
                      Access level
                    </p>

                    <p className="m-0 mt-1.5 text-sm leading-6 text-white/45">
                      {accessLevelText}
                    </p>
                  </div>
                </div>
              </section>

              <section className={protectedCardClass}>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                  Protected workspace
                </p>

                <h2 className="m-0 mt-1.5 text-lg font-extrabold text-[#f4e7b0]">
                  Data safety
                </h2>

                <p className="m-0 mt-2 text-sm leading-6 text-[#f4e7b0]/75">
                  Permanent workspace deletion is intentionally not exposed yet.
                  SunGrid keeps audit history, sprint reports, and project data
                  safe unless a deliberate admin cleanup script is used.
                </p>
              </section>

              <section className={cardClass}>
                <div className={sectionHeaderClass}>
                  <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/35">
                    Product scope
                  </p>

                  <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                    Operations focus
                  </h2>
                </div>

                <p className="m-0 mt-3 text-sm leading-6 text-white/45">
                  SunGrid is focused on workspace operations: RBAC, projects,
                  issues, boards, sprints, reports, analytics, and activity.
                  Billing has been removed from the product.
                </p>
              </section>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
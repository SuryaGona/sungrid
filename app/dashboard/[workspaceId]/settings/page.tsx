import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/workspace-auth";
import layoutStyles from "../workspace-dashboard.module.css";

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

const cardClass =
  "rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]";

const innerCardClass =
  "rounded-[2rem] border border-white/10 bg-black/25 p-5";

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/25 focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/20";

const textAreaClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/20";

const primaryButtonClass =
  "rounded-2xl border border-amber-300/30 bg-amber-300 px-5 py-3 text-sm font-black text-black transition hover:-translate-y-0.5 hover:bg-amber-200 active:translate-y-0 active:scale-[0.98]";

const slugBoxClass =
  "mt-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white/45";

const protectedCardClass =
  "rounded-[2rem] border border-amber-300/20 bg-amber-300/10 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]";

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

  return (
    <main className={layoutStyles.page}>
      <div className={layoutStyles.backgroundGlowOne} />
      <div className={layoutStyles.backgroundGlowTwo} />

      <div className={layoutStyles.shell}>
        <DashboardSidebar workspaceId={workspaceId} activePage="settings" />

        <section className={layoutStyles.content}>
          <header className={cardClass}>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
              Workspace control center
            </p>

            <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <h1 className="break-words text-4xl font-black tracking-tight text-white md:text-5xl">
                  Settings
                </h1>

                <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-white/50">
                  Manage workspace identity, ownership, and operational
                  configuration. Billing has been removed from SunGrid.
                </p>
              </div>

              <span className="w-fit rounded-full border border-white/10 bg-black/35 px-4 py-2 text-sm font-black text-white/55">
                {isGuestWorkspace ? "Guest demo" : "Owner only"}
              </span>
            </div>
          </header>

          {errorMessage ? (
            <div className="rounded-[1.5rem] border border-red-400/25 bg-red-400/10 p-5 text-sm font-bold leading-6 text-red-100">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-[1.5rem] border border-emerald-400/25 bg-emerald-400/10 p-5 text-sm font-bold leading-6 text-emerald-100">
              {successMessage}
            </div>
          ) : null}

          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
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
            ].map((stat) => (
              <div key={stat.label} className={cardClass}>
                <p className="text-sm font-bold text-white/45">{stat.label}</p>

                <p className="mt-2 break-words text-3xl font-black tracking-tight text-white">
                  {stat.value}
                </p>

                <p className="mt-2 text-sm text-white/35">{stat.helper}</p>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className={`${cardClass} lg:col-span-2`}>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                Workspace identity
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                Workspace details
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/45">
                These values define how the workspace appears across the
                dashboard. The slug is generated automatically from the name and
                kept unique.
              </p>

              <form action={updateWorkspace} className="mt-6 space-y-5">
                <input type="hidden" name="workspaceId" value={workspaceId} />

                <div>
                  <label
                    htmlFor="workspaceName"
                    className="block text-sm font-black text-white/55"
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
                    className="block text-sm font-black text-white/55"
                  >
                    Workspace description
                  </label>

                  <textarea
                    id="workspaceDescription"
                    name="workspaceDescription"
                    rows={4}
                    maxLength={300}
                    defaultValue={workspace.description || ""}
                    placeholder="Example: Product delivery workspace for planning, tracking, and sprint reports."
                    className={textAreaClass}
                  />
                </div>

                <div>
                  <p className="text-sm font-black text-white/55">
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

            <div className="space-y-6">
              <section className={cardClass}>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                  Signed in
                </p>

                <h2 className="mt-3 text-2xl font-black text-white">
                  Account access
                </h2>

                <div className="mt-5 space-y-4">
                  <div className={innerCardClass}>
                    <p className="text-sm font-black text-white/55">Email</p>

                    <p className="mt-1 break-words text-sm font-bold text-white/45">
                      {user.email}
                    </p>
                  </div>

                  <div className={innerCardClass}>
                    <p className="text-sm font-black text-white/55">Role</p>

                    <p className="mt-1 text-sm font-bold text-white/45">
                      {roleLabel}
                    </p>
                  </div>

                  <div className={innerCardClass}>
                    <p className="text-sm font-black text-white/55">
                      Access level
                    </p>

                    <p className="mt-1 text-sm leading-6 text-white/45">
                      {accessLevelText}
                    </p>
                  </div>
                </div>
              </section>

              <section className={protectedCardClass}>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                  Protected workspace
                </p>

                <h2 className="mt-3 text-2xl font-black text-amber-50">
                  Data safety
                </h2>

                <p className="mt-2 text-sm leading-6 text-amber-100/75">
                  Permanent workspace deletion is intentionally not exposed yet.
                  SunGrid keeps audit history, sprint reports, and project data
                  safe unless a deliberate admin cleanup script is used.
                </p>
              </section>

              <section className={cardClass}>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                  Product scope
                </p>

                <h2 className="mt-3 text-2xl font-black text-white">
                  Operations focus
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/45">
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
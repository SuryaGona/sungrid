import { UserButton } from "@clerk/nextjs";
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

async function getUniqueWorkspaceSlug(workspaceId: string, workspaceName: string) {
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
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-gray-500">SunGrid</p>
            <h1 className="text-xl font-bold text-gray-900">
              {workspace.name}
            </h1>
          </div>

          <UserButton  />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <DashboardSidebar workspaceId={workspaceId} activePage="settings" />

        <section className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Workspace control center
            </p>

            <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Settings</h2>

                <p className="mt-2 max-w-2xl text-gray-600">
                  Manage workspace identity, ownership, and operational
                  configuration. Billing has been removed from SunGrid.
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                Owner only
              </span>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {successMessage}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Your role</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatRole(membership.role)}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Full workspace control
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Members</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {memberCount}
              </p>
              <p className="mt-2 text-sm text-gray-500">Workspace access</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Projects</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {projectCount}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {activeProjectCount} active
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Audit events</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {activityCount}
              </p>
              <p className="mt-2 text-sm text-gray-500">Recorded actions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Workspace details
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                These values define how the workspace appears across the
                dashboard. The slug is generated automatically from the name and
                kept unique.
              </p>

              <form action={updateWorkspace} className="mt-6 space-y-5">
                <input type="hidden" name="workspaceId" value={workspaceId} />

                <div>
                  <label
                    htmlFor="workspaceName"
                    className="block text-sm font-medium text-gray-700"
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
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="workspaceDescription"
                    className="block text-sm font-medium text-gray-700"
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
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Current slug
                  </p>

                  <p className="mt-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
                    {workspace.slug || "No slug yet"}
                  </p>
                </div>

                <button
                  type="submit"
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  Save workspace
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">
                  Signed in
                </h3>

                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-700">Email</p>
                    <p className="mt-1 text-gray-600">{user.email}</p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-700">Role</p>
                    <p className="mt-1 text-gray-600">
                      {formatRole(membership.role)}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-700">Access level</p>
                    <p className="mt-1 text-gray-600">
                      Can manage workspace settings, members, projects, issues,
                      sprints, reports, and audit records.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-amber-950">
                  Protected workspace
                </h3>

                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Permanent workspace deletion is intentionally not exposed yet.
                  SunGrid keeps audit history, sprint reports, and project data
                  safe unless a deliberate admin cleanup script is used.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">
                  Product scope
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  SunGrid is focused on workspace operations: RBAC, projects,
                  issues, boards, sprints, reports, analytics, and activity.
                  Billing has been removed from the product.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
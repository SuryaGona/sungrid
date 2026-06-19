import { UserButton } from "@clerk/nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import {
  requireWorkspaceAccess,
  requireWorkspaceRole,
} from "@/lib/workspace-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MembersPageProps = {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

const addMemberSchema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["ADMIN", "MEMBER"]),
});

const updateRoleSchema = z.object({
  workspaceId: z.string().min(1),
  membershipId: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER"]),
});

const removeMemberSchema = z.object({
  workspaceId: z.string().min(1),
  membershipId: z.string().min(1),
});

function membersPageUrl(workspaceId: string, params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();

  if (!query) {
    return `/dashboard/${workspaceId}/members`;
  }

  return `/dashboard/${workspaceId}/members?${query}`;
}

function getMessage(value: string | undefined) {
  if (!value) {
    return null;
  }

  const messages: Record<string, string> = {
    "invalid-member": "Enter a valid email and role.",
    "user-not-found":
      "User not found. They must sign into SunGrid once before being added.",
    "already-member": "User is already a member of this workspace.",
    "member-added": "Member added successfully.",
    "membership-not-found": "Membership not found.",
    "cannot-change-own-role": "You cannot change your own role.",
    "cannot-change-owner": "Owner role cannot be changed from this page.",
    "role-updated": "Member role updated successfully.",
    "cannot-remove-yourself": "You cannot remove yourself from the workspace.",
    "cannot-remove-owner": "Owner cannot be removed from this page.",
    "member-removed": "Member removed successfully.",
  };

  return messages[value] ?? null;
}

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function getRoleDescription(role: string) {
  if (role === "OWNER") {
    return "Full workspace control, members, roles, projects, sprints, and settings.";
  }

  if (role === "ADMIN") {
    return "Can manage projects, issues, sprints, activity, and delivery operations.";
  }

  return "Can access workspace work and contribute to project execution.";
}

function canManageMembers(role: string) {
  return role === "OWNER";
}

async function addMember(formData: FormData) {
  "use server";

  const parsed = addMemberSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    const workspaceId = String(formData.get("workspaceId") || "");

    if (!workspaceId) {
      redirect("/dashboard");
    }

    redirect(membersPageUrl(workspaceId, { error: "invalid-member" }));
  }

  const { workspaceId, email, role } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER"]);

  const userToAdd = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!userToAdd) {
    redirect(membersPageUrl(workspaceId, { error: "user-not-found" }));
  }

  const existingMembership = await prisma.membership.findFirst({
    where: {
      workspaceId,
      userId: userToAdd.id,
    },
    select: {
      id: true,
    },
  });

  if (existingMembership) {
    redirect(membersPageUrl(workspaceId, { error: "already-member" }));
  }

  await prisma.membership.create({
    data: {
      workspaceId,
      userId: userToAdd.id,
      role,
    },
  });

  await logActivity({
    workspaceId,
    userId: user.id,
    action: "member.added",
    description: `${userToAdd.name || userToAdd.email} was added as ${role}.`,
    metadata: {
      addedUserId: userToAdd.id,
      addedUserEmail: userToAdd.email,
      addedUserName: userToAdd.name,
      role,
    },
  });

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/members`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(membersPageUrl(workspaceId, { success: "member-added" }));
}

async function updateMemberRole(formData: FormData) {
  "use server";

  const parsed = updateRoleSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    const workspaceId = String(formData.get("workspaceId") || "");

    if (!workspaceId) {
      redirect("/dashboard");
    }

    redirect(membersPageUrl(workspaceId, { error: "invalid-member" }));
  }

  const { workspaceId, membershipId, role } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER"]);

  const membership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      workspaceId,
    },
    include: {
      user: true,
    },
  });

  if (!membership) {
    redirect(membersPageUrl(workspaceId, { error: "membership-not-found" }));
  }

  if (membership.userId === user.id) {
    redirect(membersPageUrl(workspaceId, { error: "cannot-change-own-role" }));
  }

  if (membership.role === "OWNER") {
    redirect(membersPageUrl(workspaceId, { error: "cannot-change-owner" }));
  }

  const oldRole = membership.role;

  if (oldRole !== role) {
    await prisma.membership.update({
      where: {
        id: membership.id,
      },
      data: {
        role,
      },
    });

    await logActivity({
      workspaceId,
      userId: user.id,
      action: "member.role_updated",
      description: `${membership.user.name || membership.user.email} role changed from ${oldRole} to ${role}.`,
      metadata: {
        targetUserId: membership.user.id,
        targetUserEmail: membership.user.email,
        targetUserName: membership.user.name,
        oldRole,
        newRole: role,
      },
    });
  }

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/members`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(membersPageUrl(workspaceId, { success: "role-updated" }));
}

async function removeMember(formData: FormData) {
  "use server";

  const parsed = removeMemberSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    membershipId: formData.get("membershipId"),
  });

  if (!parsed.success) {
    const workspaceId = String(formData.get("workspaceId") || "");

    if (!workspaceId) {
      redirect("/dashboard");
    }

    redirect(membersPageUrl(workspaceId, { error: "membership-not-found" }));
  }

  const { workspaceId, membershipId } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER"]);

  const membership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      workspaceId,
    },
    include: {
      user: true,
    },
  });

  if (!membership) {
    redirect(membersPageUrl(workspaceId, { error: "membership-not-found" }));
  }

  if (membership.userId === user.id) {
    redirect(membersPageUrl(workspaceId, { error: "cannot-remove-yourself" }));
  }

  if (membership.role === "OWNER") {
    redirect(membersPageUrl(workspaceId, { error: "cannot-remove-owner" }));
  }

  const removedUserId = membership.user.id;
  const removedUserEmail = membership.user.email;
  const removedUserName = membership.user.name;
  const removedRole = membership.role;

  await prisma.membership.delete({
    where: {
      id: membership.id,
    },
  });

  await logActivity({
    workspaceId,
    userId: user.id,
    action: "member.removed",
    description: `${removedUserName || removedUserEmail} was removed from the workspace.`,
    metadata: {
      removedUserId,
      removedUserEmail,
      removedUserName,
      removedRole,
    },
  });

  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/members`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(membersPageUrl(workspaceId, { success: "member-removed" }));
}

export default async function MembersPage({
  params,
  searchParams,
}: MembersPageProps) {
  const { workspaceId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const errorMessage = getMessage(resolvedSearchParams.error);
  const successMessage = getMessage(resolvedSearchParams.success);

  const { workspace, user, membership } = await requireWorkspaceAccess(
    workspaceId,
  );

  const members = await prisma.membership.findMany({
    where: {
      workspaceId,
    },
    include: {
      user: true,
    },
    orderBy: [
      {
        role: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });

  const ownerCount = members.filter((member) => member.role === "OWNER").length;
  const adminCount = members.filter((member) => member.role === "ADMIN").length;
  const memberCount = members.filter(
    (member) => member.role === "MEMBER",
  ).length;

  const canManage = canManageMembers(membership.role);

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

          <UserButton />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <DashboardSidebar workspaceId={workspaceId} activePage="members" />

        <section className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Workspace access
            </p>

            <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Members</h2>

                <p className="mt-2 max-w-2xl text-gray-600">
                  Manage who can access this workspace and what each person is
                  allowed to control.
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                Your role: {formatRole(membership.role)}
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
              <p className="text-sm text-gray-500">Total members</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {members.length}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Workspace access seats
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Owners</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {ownerCount}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Full workspace control
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Admins</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {adminCount}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Delivery operations
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Members</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {memberCount}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Project contributors
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Role permissions
              </h3>

              <div className="mt-5 grid gap-3">
                {["OWNER", "ADMIN", "MEMBER"].map((role) => (
                  <div
                    key={role}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatRole(role)}
                      </p>

                      <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-600">
                        {role === "OWNER"
                          ? "Full access"
                          : role === "ADMIN"
                            ? "Manage work"
                            : "Contribute"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {getRoleDescription(role)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">
                Add member
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Add an existing SunGrid user by email. They must have signed in
                at least once before they can be added.
              </p>

              {canManage ? (
                <form action={addMember} className="mt-5 space-y-4">
                  <input type="hidden" name="workspaceId" value={workspaceId} />

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Email
                    </label>

                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="teammate@example.com"
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="role"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Role
                    </label>

                    <select
                      id="role"
                      name="role"
                      defaultValue="MEMBER"
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
                  >
                    Add member
                  </button>
                </form>
              ) : (
                <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">
                    Only workspace owners can add members or change roles.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Workspace team
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                Current users with access to this workspace.
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {members.map((member) => {
                const isCurrentUser = member.userId === user.id;
                const isOwner = member.role === "OWNER";
                const canEditThisMember = canManage && !isCurrentUser && !isOwner;

                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {member.user.name || member.user.email}
                        </p>

                        {isCurrentUser ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                            You
                          </span>
                        ) : null}

                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          {formatRole(member.role)}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-gray-600">
                        {member.user.email}
                      </p>

                      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                        {getRoleDescription(member.role)}
                      </p>

                      <p className="mt-2 text-xs text-gray-400">
                        Joined {member.createdAt.toLocaleDateString()}
                      </p>
                    </div>

                    {canEditThisMember ? (
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <form action={updateMemberRole} className="flex gap-2">
                          <input
                            type="hidden"
                            name="workspaceId"
                            value={workspaceId}
                          />
                          <input
                            type="hidden"
                            name="membershipId"
                            value={member.id}
                          />

                          <select
                            name="role"
                            defaultValue={member.role}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                          >
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                          </select>

                          <button
                            type="submit"
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Save
                          </button>
                        </form>

                        <form action={removeMember}>
                          <input
                            type="hidden"
                            name="workspaceId"
                            value={workspaceId}
                          />
                          <input
                            type="hidden"
                            name="membershipId"
                            value={member.id}
                          />

                          <button
                            type="submit"
                            className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="text-sm text-gray-500">
                          {isOwner
                            ? "Owner is protected."
                            : isCurrentUser
                              ? "Your own role is protected."
                              : "View only."}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
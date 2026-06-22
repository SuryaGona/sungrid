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
import layoutStyles from "../workspace-dashboard.module.css";

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

const cardClass =
  "rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]";

const innerCardClass =
  "rounded-[2rem] border border-white/10 bg-black/25 p-5";

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/25 focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/20";

const selectClass =
  "rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/20";

const primaryButtonClass =
  "w-full rounded-2xl border border-amber-300/30 bg-amber-300 px-4 py-3 text-sm font-black text-black transition hover:-translate-y-0.5 hover:bg-amber-200 active:translate-y-0 active:scale-[0.98]";

const secondaryButtonClass =
  "rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white/60 transition hover:-translate-y-0.5 hover:border-amber-300/25 hover:text-white active:translate-y-0 active:scale-[0.98]";

const dangerButtonClass =
  "rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-black text-red-200 transition hover:-translate-y-0.5 hover:bg-red-400/15 active:translate-y-0 active:scale-[0.98]";

const protectedNoticeClass =
  "w-fit rounded-[1.5rem] border border-white/10 bg-black/30 px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]";

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

function getGuestRoleDescription() {
  return "Guest demo access lets you explore this sample workspace while owner permissions stay protected behind the scenes.";
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

  const { user, membership, workspace } = await requireWorkspaceAccess(
    workspaceId,
  );

  const isGuestWorkspace = Boolean(user.isGuest || workspace.isGuest);
  const roleLabel = isGuestWorkspace ? "Guest" : formatRole(membership.role);

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
    <main className={layoutStyles.page}>
      <div className={layoutStyles.backgroundGlowOne} />
      <div className={layoutStyles.backgroundGlowTwo} />

      <div className={layoutStyles.shell}>
        <DashboardSidebar workspaceId={workspaceId} activePage="members" />

        <section className={layoutStyles.content}>
          <header className={cardClass}>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">
              Workspace access
            </p>

            <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <h1 className="break-words text-4xl font-black tracking-tight text-white md:text-5xl">
                  Members
                </h1>

                <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-white/50">
                  Manage who can access this workspace and what each person is
                  allowed to control.
                </p>
              </div>

              <span className="w-fit rounded-full border border-white/10 bg-black/35 px-4 py-2 text-sm font-black text-white/55">
                Your role: {roleLabel}
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
                label: "Total members",
                value: members.length,
                helper: "Workspace access seats",
              },
              {
                label: "Owners",
                value: ownerCount,
                helper: "Full workspace control",
              },
              {
                label: "Admins",
                value: adminCount,
                helper: "Delivery operations",
              },
              {
                label: "Members",
                value: memberCount,
                helper: "Project contributors",
              },
            ].map((stat) => (
              <div key={stat.label} className={cardClass}>
                <p className="text-sm font-bold text-white/45">{stat.label}</p>

                <p className="mt-2 text-3xl font-black tracking-tight text-white">
                  {stat.value}
                </p>

                <p className="mt-2 text-sm text-white/35">{stat.helper}</p>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className={`${cardClass} lg:col-span-2`}>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                Permissions
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                Role permissions
              </h2>

              <div className="mt-5 grid gap-3">
                {["OWNER", "ADMIN", "MEMBER"].map((role) => (
                  <div key={role} className={innerCardClass}>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-black text-white">
                        {formatRole(role)}
                      </p>

                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/45">
                        {role === "OWNER"
                          ? "Full access"
                          : role === "ADMIN"
                            ? "Manage work"
                            : "Contribute"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-white/45">
                      {getRoleDescription(role)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className={cardClass}>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                Invite access
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                Add member
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/45">
                Add an existing SunGrid user by email. They must have signed in
                at least once before they can be added.
              </p>

              {canManage ? (
                <form action={addMember} className="mt-5 space-y-4">
                  <input type="hidden" name="workspaceId" value={workspaceId} />

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-black text-white/55"
                    >
                      Email
                    </label>

                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="teammate@example.com"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="role"
                      className="block text-sm font-black text-white/55"
                    >
                      Role
                    </label>

                    <select
                      id="role"
                      name="role"
                      defaultValue="MEMBER"
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  <button type="submit" className={primaryButtonClass}>
                    Add member
                  </button>
                </form>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
                  <p className="text-sm leading-6 text-white/45">
                    Only workspace owners can add members or change roles.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className={cardClass}>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
                Workspace team
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                Current members
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/45">
                Current users with access to this workspace.
              </p>
            </div>

            <div className="mt-6 grid gap-4">
              {members.map((member) => {
                const isCurrentUser = member.userId === user.id;
                const isOwner = member.role === "OWNER";
                const isCurrentGuestUser =
                  isGuestWorkspace && isCurrentUser && isOwner;
                const canEditThisMember =
                  canManage && !isCurrentUser && !isOwner;

                const memberRoleLabel = isCurrentGuestUser
                  ? "Guest"
                  : formatRole(member.role);

                const memberDescription = isCurrentGuestUser
                  ? getGuestRoleDescription()
                  : getRoleDescription(member.role);

                const protectedMessage = isCurrentGuestUser
                  ? "Demo access protected."
                  : isOwner
                    ? "Owner is protected."
                    : isCurrentUser
                      ? "Your own role is protected."
                      : "View only.";

                return (
                  <div
                    key={member.id}
                    className="rounded-[2rem] border border-white/10 bg-black/25 p-6 transition hover:border-white/15 hover:bg-white/[0.04]"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-base font-black text-white">
                            {member.user.name || member.user.email}
                          </p>

                          {isCurrentUser ? (
                            <span className="rounded-full border border-white/70 bg-white/[0.04] px-3 py-1 text-xs font-black text-white">
                              You
                            </span>
                          ) : null}

                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/45">
                            {memberRoleLabel}
                          </span>
                        </div>

                        <p className="mt-1 break-words text-sm text-white/45">
                          {member.user.email}
                        </p>

                        <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-white/40">
                          {memberDescription}
                        </p>

                        <p className="mt-2 text-xs font-bold text-white/25">
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
                              className={`${selectClass} cursor-pointer`}
                            >
                              <option value="MEMBER">Member</option>
                              <option value="ADMIN">Admin</option>
                            </select>

                            <button
                              type="submit"
                              className={secondaryButtonClass}
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

                            <button type="submit" className={dangerButtonClass}>
                              Remove
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div className={protectedNoticeClass}>
                          <p className="text-sm font-black text-white/75">
                            {protectedMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
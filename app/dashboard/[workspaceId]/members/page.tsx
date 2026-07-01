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

const roleCardClass =
  "rounded-[1.1rem] border border-white/10 bg-black/30 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition hover:border-[#d6bf76]/15 hover:bg-white/[0.035]";

const memberCardClass =
  "rounded-[1.2rem] border border-white/10 bg-black/30 p-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition hover:border-[#d6bf76]/15 hover:bg-white/[0.035]";

const badgeClass =
  "rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-white/55";

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d6bf76]/60";

const selectClass =
  "rounded-2xl border border-white/10 bg-black/35 px-3.5 py-2 text-sm text-white outline-none focus:border-[#d6bf76]/60";

const optionClass = "bg-[#050505] text-white";

const primaryButtonClass =
  "w-fit rounded-full border border-[#d6bf76]/25 bg-[#d6bf76]/[0.12] px-4 py-2 text-sm font-extrabold text-[#f4e7b0] transition hover:-translate-y-px hover:bg-[#d6bf76]/[0.18] hover:text-white active:translate-y-0 active:scale-[0.98]";

const secondaryButtonClass =
  "rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-bold text-white/55 transition hover:-translate-y-px hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]";

const dangerButtonClass =
  "rounded-full border border-red-400/20 px-3.5 py-1.5 text-xs font-bold text-red-200 transition hover:-translate-y-px hover:bg-red-400/10 active:translate-y-0 active:scale-[0.98]";

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

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
    select: {
      id: true,
      role: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
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
    select: {
      id: true,
      role: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
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
    select: {
      id: true,
      role: true,
      userId: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
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

  const metrics = [
    {
      label: "Total members",
      value: members.length,
      helper: "Workspace access seats",
    },
    {
      label: "Owners",
      value: ownerCount,
      helper: "Full control",
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
  ];

  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <div className={shellClass}>
        <DashboardSidebar workspaceId={workspaceId} activePage="members" />

        <section className={contentClass}>
          <header className={heroCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
                  Workspace access
                </p>

                <h1 className="m-0 mt-1 truncate text-[25px] font-extrabold tracking-[-0.04em] text-white md:text-[28px]">
                  Members
                </h1>

                <p className="m-0 mt-1 max-w-3xl truncate text-sm text-white/45">
                  Manage who can access this workspace and what each person can
                  control.
                </p>
              </div>

              <div className="flex min-w-0 flex-wrap justify-end gap-2">
                <span className="max-w-[220px] truncate rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-xs font-bold text-white/50">
                  {workspace.name}
                </span>

                <span className="rounded-full border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] px-2.5 py-1 text-xs font-extrabold text-[#f4e7b0]">
                  Your role: {roleLabel}
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
                  Permissions
                </p>

                <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                  Role permissions
                </h2>
              </div>

              <div className="mt-3 grid gap-3">
                {["OWNER", "ADMIN", "MEMBER"].map((role) => (
                  <div key={role} className={roleCardClass}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="m-0 text-sm font-extrabold text-white">
                        {formatRole(role)}
                      </p>

                      <span className={badgeClass}>
                        {role === "OWNER"
                          ? "Full access"
                          : role === "ADMIN"
                            ? "Manage work"
                            : "Contribute"}
                      </span>
                    </div>

                    <p className="m-0 mt-1.5 text-sm leading-5 text-white/45">
                      {getRoleDescription(role)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className={cardClass}>
              <div className={sectionHeaderClass}>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                  Invite access
                </p>

                <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                  Add member
                </h2>
              </div>

              <p className="m-0 mt-3 text-sm leading-6 text-white/45">
                Add an existing SunGrid user by email. They must have signed in
                once before they can be added.
              </p>

              {canManage ? (
                <form action={addMember} className="mt-4 grid gap-4">
                  <input type="hidden" name="workspaceId" value={workspaceId} />

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-bold text-white/70"
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
                      className="block text-sm font-bold text-white/70"
                    >
                      Role
                    </label>

                    <select
                      id="role"
                      name="role"
                      defaultValue="MEMBER"
                      className={`${inputClass} cursor-pointer`}
                      style={{ colorScheme: "dark" }}
                    >
                      <option value="MEMBER" className={optionClass}>
                        Member
                      </option>

                      <option value="ADMIN" className={optionClass}>
                        Admin
                      </option>
                    </select>
                  </div>

                  <button type="submit" className={primaryButtonClass}>
                    Add member
                  </button>
                </form>
              ) : (
                <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-black/25 p-4 text-sm leading-6 text-white/45">
                  Only workspace owners can add members or change roles.
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                Workspace team
              </p>

              <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                Current members
              </h2>
            </div>

            <div className="grid gap-3">
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
                  ? "Demo access protected"
                  : isOwner
                    ? "Owner protected"
                    : isCurrentUser
                      ? "Your role protected"
                      : "View only";

                return (
                  <article key={member.id} className={memberCardClass}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="m-0 break-words text-sm font-extrabold text-white">
                            {member.user.name || member.user.email}
                          </p>

                          {isCurrentUser ? (
                            <span className="rounded-full border border-white/20 bg-white/[0.06] px-2.5 py-1 text-xs font-extrabold text-white">
                              You
                            </span>
                          ) : null}

                          <span className={badgeClass}>{memberRoleLabel}</span>
                        </div>

                        <p className="m-0 mt-1 break-words text-sm text-white/45">
                          {member.user.email}
                        </p>

                        <p className="m-0 mt-1.5 max-w-2xl break-words text-sm leading-5 text-white/38">
                          {memberDescription}
                        </p>

                        <p className="m-0 mt-2 text-xs font-bold text-white/25">
                          Joined {member.createdAt.toLocaleDateString()}
                        </p>
                      </div>

                      {canEditThisMember ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <form
                            action={updateMemberRole}
                            className="flex flex-wrap gap-2"
                          >
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
                              style={{ colorScheme: "dark" }}
                            >
                              <option value="MEMBER" className={optionClass}>
                                Member
                              </option>

                              <option value="ADMIN" className={optionClass}>
                                Admin
                              </option>
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
                        <div className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/35">
                          {protectedMessage}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
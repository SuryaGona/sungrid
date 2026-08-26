import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireWorkspaceAccess: vi.fn(),
  requireWorkspaceRole: vi.fn(),

  membershipFindMany: vi.fn(),
  membershipFindFirst: vi.fn(),
  membershipCreate: vi.fn(),
  membershipUpdate: vi.fn(),
  membershipDelete: vi.fn(),

  userFindUnique: vi.fn(),

  logActivity: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/workspace-auth", () => ({
  requireWorkspaceAccess: mocks.requireWorkspaceAccess,
  requireWorkspaceRole: mocks.requireWorkspaceRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findMany: mocks.membershipFindMany,
      findFirst: mocks.membershipFindFirst,
      create: mocks.membershipCreate,
      update: mocks.membershipUpdate,
      delete: mocks.membershipDelete,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

vi.mock("@/lib/activity", () => ({
  logActivity: mocks.logActivity,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/components/dashboard-sidebar", () => ({
  DashboardSidebar: () => null,
}));

import MembersPage from "@/app/dashboard/[workspaceId]/members/page";

type ElementWithProps = ReactElement<Record<string, unknown>>;

function createWorkspace() {
  return {
    id: "workspace-a",
    name: "Workspace A",
    slug: "workspace-a",
    description: null,
    isGuest: false,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createCurrentUser() {
  return {
    id: "owner-user",
    clerkId: "clerk-owner",
    email: "owner@example.com",
    name: "Owner User",
    imageUrl: null,
    isGuest: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createCurrentMembership(
  role: "OWNER" | "ADMIN" | "MEMBER" = "OWNER",
) {
  return {
    id: "owner-membership",
    role,
    userId: "owner-user",
    workspaceId: "workspace-a",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createListedMember({
  id,
  userId,
  role,
  email,
  name,
}: {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  email: string;
  name: string;
}) {
  return {
    id,
    role,
    userId,
    createdAt: new Date(),
    user: {
      id: userId,
      name,
      email,
    },
  };
}

function createTargetMembership({
  id = "member-b",
  userId = "member-user",
  role = "MEMBER",
  name = "Member User",
  email = "member@example.com",
}: {
  id?: string;
  userId?: string;
  role?: "OWNER" | "ADMIN" | "MEMBER";
  name?: string;
  email?: string;
} = {}) {
  return {
    id,
    role,
    userId,
    user: {
      id: userId,
      name,
      email,
    },
  };
}

function collectElements(node: ReactNode): ElementWithProps[] {
  const elements: ElementWithProps[] = [];

  function visit(current: ReactNode) {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    if (!isValidElement(current)) {
      return;
    }

    const element = current as ElementWithProps;
    elements.push(element);

    visit(element.props.children as ReactNode);
  }

  visit(node);

  return elements;
}

function hasNamedDescendant(
  element: ElementWithProps,
  type: string,
  name: string,
) {
  return collectElements(element.props.children as ReactNode).some(
    (child) => child.type === type && child.props.name === name,
  );
}

function getFormAction(
  root: ReactNode,
  predicate: (form: ElementWithProps) => boolean,
) {
  const form = collectElements(root).find(
    (element) => element.type === "form" && predicate(element),
  );

  if (!form) {
    throw new Error("Expected form was not found.");
  }

  const action = form.props.action;

  if (typeof action !== "function") {
    throw new Error("Expected form action was not a function.");
  }

  return action as (formData: FormData) => Promise<unknown>;
}

async function renderOwnerMembersPage() {
  return MembersPage({
    params: Promise.resolve({
      workspaceId: "workspace-a",
    }),
  });
}

describe("members page permissions", () => {
  beforeEach(() => {
    mocks.requireWorkspaceAccess.mockReset();
    mocks.requireWorkspaceRole.mockReset();

    mocks.membershipFindMany.mockReset();
    mocks.membershipFindFirst.mockReset();
    mocks.membershipCreate.mockReset();
    mocks.membershipUpdate.mockReset();
    mocks.membershipDelete.mockReset();

    mocks.userFindUnique.mockReset();

    mocks.logActivity.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.redirect.mockReset();

    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });

    const user = createCurrentUser();
    const workspace = createWorkspace();
    const membership = createCurrentMembership("OWNER");

    mocks.requireWorkspaceAccess.mockResolvedValue({
      authMode: "clerk",
      clerkUserId: user.clerkId,
      user,
      membership,
      workspace,
    });

    mocks.requireWorkspaceRole.mockResolvedValue({
      authMode: "clerk",
      clerkUserId: user.clerkId,
      user,
      membership,
      workspace,
    });

    mocks.membershipFindMany.mockResolvedValue([
      createListedMember({
        id: "owner-membership",
        userId: "owner-user",
        role: "OWNER",
        email: "owner@example.com",
        name: "Owner User",
      }),
      createListedMember({
        id: "member-b",
        userId: "member-user",
        role: "MEMBER",
        email: "member@example.com",
        name: "Member User",
      }),
    ]);

    mocks.logActivity.mockResolvedValue(undefined);
  });

  it("scopes the member list query to the requested workspace", async () => {
    await renderOwnerMembersPage();

    expect(mocks.requireWorkspaceAccess).toHaveBeenCalledWith("workspace-a");

    expect(mocks.membershipFindMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-a",
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
  });

  it("shows member-management forms only to workspace owners", async () => {
    const ownerTree = await renderOwnerMembersPage();

    const ownerForms = collectElements(ownerTree).filter(
      (element) => element.type === "form",
    );

    expect(ownerForms).toHaveLength(3);

    mocks.requireWorkspaceAccess.mockResolvedValue({
      authMode: "clerk",
      clerkUserId: "clerk-admin",
      user: {
        ...createCurrentUser(),
        id: "admin-user",
        clerkId: "clerk-admin",
      },
      membership: {
        ...createCurrentMembership("ADMIN"),
        id: "admin-membership",
        userId: "admin-user",
      },
      workspace: createWorkspace(),
    });

    mocks.membershipFindMany.mockResolvedValue([
      createListedMember({
        id: "owner-membership",
        userId: "owner-user",
        role: "OWNER",
        email: "owner@example.com",
        name: "Owner User",
      }),
      createListedMember({
        id: "admin-membership",
        userId: "admin-user",
        role: "ADMIN",
        email: "admin@example.com",
        name: "Admin User",
      }),
    ]);

    const adminTree = await MembersPage({
      params: Promise.resolve({
        workspaceId: "workspace-a",
      }),
    });

    const adminForms = collectElements(adminTree).filter(
      (element) => element.type === "form",
    );

    expect(adminForms).toHaveLength(0);
  });

  it("requires OWNER authorization before the add-member action touches membership data", async () => {
    const tree = await renderOwnerMembersPage();

    const addMemberAction = getFormAction(
      tree,
      (form) =>
        hasNamedDescendant(form, "input", "email") &&
        hasNamedDescendant(form, "select", "role"),
    );

    mocks.requireWorkspaceRole.mockRejectedValue(
      new Error("OWNER_REQUIRED"),
    );

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("email", "newmember@example.com");
    formData.set("role", "MEMBER");

    await expect(addMemberAction(formData)).rejects.toThrow("OWNER_REQUIRED");

    expect(mocks.requireWorkspaceRole).toHaveBeenCalledWith(
      "workspace-a",
      ["OWNER"],
    );

    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.membershipFindFirst).not.toHaveBeenCalled();
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
  });

  it("scopes role-update membership lookup to both membership ID and workspace ID", async () => {
    const tree = await renderOwnerMembersPage();

    const updateRoleAction = getFormAction(
      tree,
      (form) =>
        hasNamedDescendant(form, "input", "membershipId") &&
        hasNamedDescendant(form, "select", "role"),
    );

    mocks.membershipFindFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("membershipId", "membership-from-workspace-b");
    formData.set("role", "ADMIN");

    await expect(updateRoleAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/members?error=membership-not-found",
    );

    expect(mocks.requireWorkspaceRole).toHaveBeenCalledWith(
      "workspace-a",
      ["OWNER"],
    );

    expect(mocks.membershipFindFirst).toHaveBeenCalledWith({
      where: {
        id: "membership-from-workspace-b",
        workspaceId: "workspace-a",
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

    expect(mocks.membershipUpdate).not.toHaveBeenCalled();
  });

  it("scopes member removal lookup to both membership ID and workspace ID", async () => {
    const tree = await renderOwnerMembersPage();

    const removeMemberAction = getFormAction(
      tree,
      (form) =>
        hasNamedDescendant(form, "input", "membershipId") &&
        !hasNamedDescendant(form, "select", "role"),
    );

    mocks.membershipFindFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("membershipId", "membership-from-workspace-b");

    await expect(removeMemberAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/members?error=membership-not-found",
    );

    expect(mocks.requireWorkspaceRole).toHaveBeenCalledWith(
      "workspace-a",
      ["OWNER"],
    );

    expect(mocks.membershipFindFirst).toHaveBeenCalledWith({
      where: {
        id: "membership-from-workspace-b",
        workspaceId: "workspace-a",
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

    expect(mocks.membershipDelete).not.toHaveBeenCalled();
  });

  it("prevents the current user from changing their own role", async () => {
    const tree = await renderOwnerMembersPage();

    const updateRoleAction = getFormAction(
      tree,
      (form) =>
        hasNamedDescendant(form, "input", "membershipId") &&
        hasNamedDescendant(form, "select", "role"),
    );

    mocks.membershipFindFirst.mockResolvedValue(
      createTargetMembership({
        id: "owner-membership",
        userId: "owner-user",
        role: "OWNER",
        name: "Owner User",
        email: "owner@example.com",
      }),
    );

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("membershipId", "owner-membership");
    formData.set("role", "ADMIN");

    await expect(updateRoleAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/members?error=cannot-change-own-role",
    );

    expect(mocks.membershipUpdate).not.toHaveBeenCalled();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("prevents another owner role from being changed", async () => {
    const tree = await renderOwnerMembersPage();

    const updateRoleAction = getFormAction(
      tree,
      (form) =>
        hasNamedDescendant(form, "input", "membershipId") &&
        hasNamedDescendant(form, "select", "role"),
    );

    mocks.membershipFindFirst.mockResolvedValue(
      createTargetMembership({
        id: "other-owner-membership",
        userId: "other-owner-user",
        role: "OWNER",
        name: "Other Owner",
        email: "other-owner@example.com",
      }),
    );

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("membershipId", "other-owner-membership");
    formData.set("role", "ADMIN");

    await expect(updateRoleAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/members?error=cannot-change-owner",
    );

    expect(mocks.membershipUpdate).not.toHaveBeenCalled();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("prevents the current user from removing themselves", async () => {
    const tree = await renderOwnerMembersPage();

    const removeMemberAction = getFormAction(
      tree,
      (form) =>
        hasNamedDescendant(form, "input", "membershipId") &&
        !hasNamedDescendant(form, "select", "role"),
    );

    mocks.membershipFindFirst.mockResolvedValue(
      createTargetMembership({
        id: "owner-membership",
        userId: "owner-user",
        role: "OWNER",
        name: "Owner User",
        email: "owner@example.com",
      }),
    );

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("membershipId", "owner-membership");

    await expect(removeMemberAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/members?error=cannot-remove-yourself",
    );

    expect(mocks.membershipDelete).not.toHaveBeenCalled();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("prevents another owner from being removed", async () => {
    const tree = await renderOwnerMembersPage();

    const removeMemberAction = getFormAction(
      tree,
      (form) =>
        hasNamedDescendant(form, "input", "membershipId") &&
        !hasNamedDescendant(form, "select", "role"),
    );

    mocks.membershipFindFirst.mockResolvedValue(
      createTargetMembership({
        id: "other-owner-membership",
        userId: "other-owner-user",
        role: "OWNER",
        name: "Other Owner",
        email: "other-owner@example.com",
      }),
    );

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("membershipId", "other-owner-membership");

    await expect(removeMemberAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/members?error=cannot-remove-owner",
    );

    expect(mocks.membershipDelete).not.toHaveBeenCalled();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cookies: vi.fn(),
  redirect: vi.fn(),
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  retryAsync: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      findFirst: mocks.userFindFirst,
    },
  },
}));

vi.mock("@/lib/retry", () => ({
  retryAsync: mocks.retryAsync,
}));

import {
  requireWorkspaceAccess,
  requireWorkspaceRole,
  WorkspaceDatabaseError,
} from "@/lib/workspace-auth";

function createWorkspace({
  id = "workspace-1",
  isGuest = false,
  expiresAt = null,
}: {
  id?: string;
  isGuest?: boolean;
  expiresAt?: Date | null;
} = {}) {
  return {
    id,
    name: "Test Workspace",
    slug: "test-workspace",
    description: null,
    isGuest,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMembership({
  role = "MEMBER",
  workspace = createWorkspace(),
}: {
  role?: "OWNER" | "ADMIN" | "MEMBER";
  workspace?: ReturnType<typeof createWorkspace>;
} = {}) {
  return {
    id: "membership-1",
    role,
    userId: "user-1",
    workspaceId: workspace.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspace,
  };
}

function createUser({
  clerkId = "clerk-user-1",
  isGuest = false,
  memberships = [],
}: {
  clerkId?: string;
  isGuest?: boolean;
  memberships?: ReturnType<typeof createMembership>[];
} = {}) {
  return {
    id: "user-1",
    clerkId,
    email: "user@example.com",
    name: "Test User",
    imageUrl: null,
    isGuest,
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships,
  };
}

describe("workspace authorization", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.cookies.mockReset();
    mocks.redirect.mockReset();
    mocks.userFindUnique.mockReset();
    mocks.userFindFirst.mockReset();
    mocks.retryAsync.mockReset();

    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });

    mocks.retryAsync.mockImplementation(
      async (operation: () => Promise<unknown>) => operation(),
    );

    mocks.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });
  });

  describe("requireWorkspaceAccess", () => {
    it("returns Clerk workspace context when the user has membership", async () => {
      const workspace = createWorkspace();
      const membership = createMembership({
        role: "MEMBER",
        workspace,
      });

      const user = createUser({
        clerkId: "clerk-user-1",
        memberships: [membership],
      });

      mocks.auth.mockResolvedValue({
        userId: "clerk-user-1",
      });

      mocks.userFindUnique.mockResolvedValue(user);

      const result = await requireWorkspaceAccess("workspace-1");

      expect(result.authMode).toBe("clerk");
      expect(result.clerkUserId).toBe("clerk-user-1");
      expect(result.user).toBe(user);
      expect(result.membership).toBe(membership);
      expect(result.workspace).toBe(workspace);

      expect(mocks.userFindUnique).toHaveBeenCalledWith({
        where: {
          clerkId: "clerk-user-1",
        },
        include: {
          memberships: {
            where: {
              workspaceId: "workspace-1",
            },
            include: {
              workspace: true,
            },
          },
        },
      });

      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("redirects an unauthenticated user to the home page", async () => {
      mocks.auth.mockResolvedValue({
        userId: null,
      });

      await expect(requireWorkspaceAccess("workspace-1")).rejects.toThrow(
        "REDIRECT:/",
      );

      expect(mocks.redirect).toHaveBeenCalledWith("/");
    });

    it("redirects a Clerk user without workspace membership to the dashboard", async () => {
      const user = createUser({
        clerkId: "clerk-user-1",
        memberships: [],
      });

      mocks.auth.mockResolvedValue({
        userId: "clerk-user-1",
      });

      mocks.userFindUnique.mockResolvedValue(user);

      await expect(requireWorkspaceAccess("workspace-1")).rejects.toThrow(
        "REDIRECT:/dashboard",
      );

      expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
    });

    it("allows an active guest user with matching workspace membership", async () => {
      const workspace = createWorkspace({
        isGuest: true,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const membership = createMembership({
        role: "MEMBER",
        workspace,
      });

      const guestUser = createUser({
        clerkId: "guest-clerk-placeholder",
        isGuest: true,
        memberships: [membership],
      });

      mocks.auth.mockResolvedValue({
        userId: null,
      });

      mocks.cookies.mockResolvedValue({
        get: vi.fn().mockReturnValue({
          value: "user-1",
        }),
      });

      mocks.userFindFirst.mockResolvedValue(guestUser);

      const result = await requireWorkspaceAccess("workspace-1");

      expect(result.authMode).toBe("guest");
      expect(result.clerkUserId).toBeNull();
      expect(result.workspace).toBe(workspace);
      expect(result.membership).toBe(membership);

      expect(mocks.userFindFirst).toHaveBeenCalledWith({
        where: {
          id: "user-1",
          isGuest: true,
        },
        include: {
          memberships: {
            where: {
              workspaceId: "workspace-1",
            },
            include: {
              workspace: true,
            },
          },
        },
      });
    });

    it("rejects an expired guest workspace", async () => {
      const workspace = createWorkspace({
        isGuest: true,
        expiresAt: new Date(Date.now() - 60_000),
      });

      const membership = createMembership({
        role: "MEMBER",
        workspace,
      });

      const guestUser = createUser({
        isGuest: true,
        memberships: [membership],
      });

      mocks.auth.mockResolvedValue({
        userId: null,
      });

      mocks.cookies.mockResolvedValue({
        get: vi.fn().mockReturnValue({
          value: "user-1",
        }),
      });

      mocks.userFindFirst.mockResolvedValue(guestUser);

      await expect(requireWorkspaceAccess("workspace-1")).rejects.toThrow(
        "REDIRECT:/?guest=expired",
      );

      expect(mocks.redirect).toHaveBeenCalledWith("/?guest=expired");
    });

    it("converts workspace lookup failures into WorkspaceDatabaseError", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mocks.auth.mockResolvedValue({
        userId: "clerk-user-1",
      });

      mocks.userFindUnique.mockRejectedValue(new Error("database unavailable"));

      await expect(requireWorkspaceAccess("workspace-1")).rejects.toBeInstanceOf(
        WorkspaceDatabaseError,
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("requireWorkspaceRole", () => {
    it("allows a user whose role is in the allowed role list", async () => {
      const workspace = createWorkspace();

      const membership = createMembership({
        role: "ADMIN",
        workspace,
      });

      const user = createUser({
        memberships: [membership],
      });

      mocks.auth.mockResolvedValue({
        userId: "clerk-user-1",
      });

      mocks.userFindUnique.mockResolvedValue(user);

      const result = await requireWorkspaceRole("workspace-1", [
        "OWNER",
        "ADMIN",
      ]);

      expect(result.membership.role).toBe("ADMIN");
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("redirects a user whose role is not permitted", async () => {
      const workspace = createWorkspace();

      const membership = createMembership({
        role: "MEMBER",
        workspace,
      });

      const user = createUser({
        memberships: [membership],
      });

      mocks.auth.mockResolvedValue({
        userId: "clerk-user-1",
      });

      mocks.userFindUnique.mockResolvedValue(user);

      await expect(
        requireWorkspaceRole("workspace-1", ["OWNER", "ADMIN"]),
      ).rejects.toThrow("REDIRECT:/dashboard/workspace-1");

      expect(mocks.redirect).toHaveBeenCalledWith(
        "/dashboard/workspace-1",
      );
    });
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cookies: vi.fn(),
  revalidatePath: vi.fn(),

  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),

  issueFindFirst: vi.fn(),
  issueCount: vi.fn(),
  issueUpdate: vi.fn(),

  logActivity: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      findFirst: mocks.userFindFirst,
    },
    issue: {
      findFirst: mocks.issueFindFirst,
      count: mocks.issueCount,
      update: mocks.issueUpdate,
    },
  },
}));

vi.mock("@/lib/activity", () => ({
  logActivity: mocks.logActivity,
}));

import { PATCH } from "@/app/api/workspaces/[workspaceId]/projects/[projectId]/issues/move/route";

function createRequest(body: unknown) {
  return new Request(
    "http://localhost/api/workspaces/workspace-1/projects/project-1/issues/move",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

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
  workspace = createWorkspace(),
  role = "MEMBER",
}: {
  workspace?: ReturnType<typeof createWorkspace>;
  role?: "OWNER" | "ADMIN" | "MEMBER";
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
  memberships = [createMembership()],
}: {
  memberships?: ReturnType<typeof createMembership>[];
} = {}) {
  return {
    id: "user-1",
    clerkId: "clerk-user-1",
    email: "user@example.com",
    name: "Test User",
    imageUrl: null,
    isGuest: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships,
  };
}

function createIssue({
  id = "issue-1",
  workspaceId = "workspace-1",
  projectId = "project-1",
  status = "TODO",
  projectArchived = false,
}: {
  id?: string;
  workspaceId?: string;
  projectId?: string;
  status?: "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  projectArchived?: boolean;
} = {}) {
  return {
    id,
    title: "Test Issue",
    description: null,
    status,
    priority: "MEDIUM",
    type: "TASK",
    storyPoints: null,
    position: 1,
    archived: false,
    workspaceId,
    projectId,
    sprintId: null,
    reporterId: null,
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    project: {
      id: projectId,
      name: "Test Project",
      description: null,
      archived: projectArchived,
      workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

describe("PATCH move issue route", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.cookies.mockReset();
    mocks.revalidatePath.mockReset();

    mocks.userFindUnique.mockReset();
    mocks.userFindFirst.mockReset();

    mocks.issueFindFirst.mockReset();
    mocks.issueCount.mockReset();
    mocks.issueUpdate.mockReset();

    mocks.logActivity.mockReset();

    mocks.auth.mockResolvedValue({
      userId: "clerk-user-1",
    });

    mocks.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });

    mocks.userFindUnique.mockResolvedValue(createUser());

    mocks.logActivity.mockResolvedValue(undefined);
  });

  it("rejects an invalid issue status before authorization or database work", async () => {
    const request = createRequest({
      issueId: "issue-1",
      status: "INVALID_STATUS",
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        workspaceId: "workspace-1",
        projectId: "project-1",
      }),
    });

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid request",
    });

    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.issueFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a request when the authenticated user has no workspace membership", async () => {
    mocks.userFindUnique.mockResolvedValue(
      createUser({
        memberships: [],
      }),
    );

    const request = createRequest({
      issueId: "issue-1",
      status: "IN_PROGRESS",
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        workspaceId: "workspace-1",
        projectId: "project-1",
      }),
    });

    expect(response.status).toBe(403);

    await expect(response.json()).resolves.toEqual({
      error: "Forbidden",
    });

    expect(mocks.issueFindFirst).not.toHaveBeenCalled();
    expect(mocks.issueUpdate).not.toHaveBeenCalled();
  });

  it("rejects an expired guest workspace", async () => {
    const workspace = createWorkspace({
      isGuest: true,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const membership = createMembership({
      workspace,
    });

    mocks.auth.mockResolvedValue({
      userId: null,
    });

    mocks.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({
        value: "guest-user-1",
      }),
    });

    mocks.userFindFirst.mockResolvedValue({
      ...createUser({
        memberships: [membership],
      }),
      id: "guest-user-1",
      clerkId: "guest-clerk-id",
      isGuest: true,
    });

    const request = createRequest({
      issueId: "issue-1",
      status: "IN_PROGRESS",
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        workspaceId: "workspace-1",
        projectId: "project-1",
      }),
    });

    expect(response.status).toBe(403);

    await expect(response.json()).resolves.toEqual({
      error: "Guest workspace expired",
    });

    expect(mocks.issueFindFirst).not.toHaveBeenCalled();
  });

  it("scopes issue lookup to the requested workspace and project", async () => {
    mocks.issueFindFirst.mockResolvedValue(null);

    const request = createRequest({
      issueId: "issue-from-another-tenant",
      status: "IN_PROGRESS",
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        workspaceId: "workspace-1",
        projectId: "project-1",
      }),
    });

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toEqual({
      error: "Issue not found",
    });

    expect(mocks.issueFindFirst).toHaveBeenCalledWith({
      where: {
        id: "issue-from-another-tenant",
        workspaceId: "workspace-1",
        projectId: "project-1",
        archived: false,
      },
      include: {
        project: true,
      },
    });

    expect(mocks.issueUpdate).not.toHaveBeenCalled();
  });

  it("rejects issue movement when the project is archived", async () => {
    mocks.issueFindFirst.mockResolvedValue(
      createIssue({
        projectArchived: true,
      }),
    );

    const request = createRequest({
      issueId: "issue-1",
      status: "IN_PROGRESS",
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        workspaceId: "workspace-1",
        projectId: "project-1",
      }),
    });

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Archived projects are read-only",
    });

    expect(mocks.issueCount).not.toHaveBeenCalled();
    expect(mocks.issueUpdate).not.toHaveBeenCalled();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("returns the existing issue without writing when status is unchanged", async () => {
    const issue = createIssue({
      status: "TODO",
    });

    mocks.issueFindFirst.mockResolvedValue(issue);

    const request = createRequest({
      issueId: "issue-1",
      status: "TODO",
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        workspaceId: "workspace-1",
        projectId: "project-1",
      }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.issue.id).toBe("issue-1");
    expect(body.issue.status).toBe("TODO");

    expect(mocks.issueCount).not.toHaveBeenCalled();
    expect(mocks.issueUpdate).not.toHaveBeenCalled();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("moves a valid issue to the target column with the next position", async () => {
    const issue = createIssue({
      status: "TODO",
    });

    const updatedIssue = {
      ...issue,
      status: "IN_PROGRESS",
      position: 4,
    };

    mocks.issueFindFirst.mockResolvedValue(issue);
    mocks.issueCount.mockResolvedValue(3);
    mocks.issueUpdate.mockResolvedValue(updatedIssue);

    const request = createRequest({
      issueId: "issue-1",
      status: "IN_PROGRESS",
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        workspaceId: "workspace-1",
        projectId: "project-1",
      }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.issue.id).toBe("issue-1");
    expect(body.issue.status).toBe("IN_PROGRESS");
    expect(body.issue.position).toBe(4);

    expect(mocks.issueCount).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        projectId: "project-1",
        status: "IN_PROGRESS",
        archived: false,
      },
    });

    expect(mocks.issueUpdate).toHaveBeenCalledWith({
      where: {
        id: "issue-1",
      },
      data: {
        status: "IN_PROGRESS",
        position: 4,
      },
    });
  });

  it("logs the move and revalidates existing affected pages after success", async () => {
    const issue = createIssue({
      status: "BACKLOG",
    });

    const updatedIssue = {
      ...issue,
      status: "DONE",
      position: 2,
    };

    mocks.issueFindFirst.mockResolvedValue(issue);
    mocks.issueCount.mockResolvedValue(1);
    mocks.issueUpdate.mockResolvedValue(updatedIssue);

    const request = createRequest({
      issueId: "issue-1",
      status: "DONE",
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        workspaceId: "workspace-1",
        projectId: "project-1",
      }),
    });

    expect(response.status).toBe(200);

    expect(mocks.logActivity).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      issueId: "issue-1",
      action: "issue.moved",
      description: 'Moved issue "Test Issue" from Backlog to Done.',
      metadata: {
        issueId: "issue-1",
        issueTitle: "Test Issue",
        projectId: "project-1",
        projectName: "Test Project",
        oldStatus: "BACKLOG",
        newStatus: "DONE",
      },
    });

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/workspace-1/projects/project-1/board",
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/workspace-1/projects/project-1",
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/workspace-1/projects/project-1/issues/issue-1",
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/workspace-1/activity",
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/workspace-1/analytics",
    );
  });
});
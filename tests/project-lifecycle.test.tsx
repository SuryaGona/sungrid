import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireWorkspaceAccess: vi.fn(),
  requireWorkspaceRole: vi.fn(),

  transaction: vi.fn(),

  projectFindMany: vi.fn(),
  projectFindFirst: vi.fn(),
  projectCreate: vi.fn(),
  projectUpdateMany: vi.fn(),
  projectDelete: vi.fn(),

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
    $transaction: mocks.transaction,
    project: {
      findMany: mocks.projectFindMany,
      findFirst: mocks.projectFindFirst,
      create: mocks.projectCreate,
      updateMany: mocks.projectUpdateMany,
      delete: mocks.projectDelete,
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

import ProjectsPage from "@/app/dashboard/[workspaceId]/projects/page";

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

function createUser() {
  return {
    id: "user-1",
    clerkId: "clerk-user-1",
    email: "owner@example.com",
    name: "Owner User",
    imageUrl: null,
    isGuest: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMembership(
  role: "OWNER" | "ADMIN" | "MEMBER" = "OWNER",
) {
  return {
    id: "membership-1",
    role,
    userId: "user-1",
    workspaceId: "workspace-a",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createProject({
  id,
  name,
  archived,
}: {
  id: string;
  name: string;
  archived: boolean;
}) {
  return {
    id,
    name,
    description: null,
    archived,
    workspaceId: "workspace-a",
    createdAt: new Date(),
    updatedAt: new Date(),
    issues: [],
    _count: {
      issues: 0,
      sprints: 0,
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

function hasHiddenInput(
  form: ElementWithProps,
  name: string,
  value: string,
) {
  return collectElements(form.props.children as ReactNode).some(
    (element) =>
      element.type === "input" &&
      element.props.type === "hidden" &&
      element.props.name === name &&
      element.props.value === value,
  );
}

function getButtonText(form: ElementWithProps) {
  const button = collectElements(form.props.children as ReactNode).find(
    (element) => element.type === "button",
  );

  return button?.props.children;
}

function getProjectAction(
  root: ReactNode,
  projectId: string,
  buttonText: string,
) {
  const form = collectElements(root).find(
    (element) =>
      element.type === "form" &&
      hasHiddenInput(element, "projectId", projectId) &&
      getButtonText(element) === buttonText,
  );

  if (!form) {
    throw new Error(
      `Expected ${buttonText} form for project ${projectId} was not found.`,
    );
  }

  const action = form.props.action;

  if (typeof action !== "function") {
    throw new Error("Expected project form action to be a function.");
  }

  return action as (formData: FormData) => Promise<unknown>;
}

async function renderProjectsPage(
  role: "OWNER" | "ADMIN" | "MEMBER" = "OWNER",
) {
  const user = createUser();
  const workspace = createWorkspace();
  const membership = createMembership(role);

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

  return ProjectsPage({
    params: Promise.resolve({
      workspaceId: "workspace-a",
    }),
  });
}

describe("project archive and restore lifecycle", () => {
  beforeEach(() => {
    mocks.requireWorkspaceAccess.mockReset();
    mocks.requireWorkspaceRole.mockReset();

    mocks.transaction.mockReset();

    mocks.projectFindMany.mockReset();
    mocks.projectFindFirst.mockReset();
    mocks.projectCreate.mockReset();
    mocks.projectUpdateMany.mockReset();
    mocks.projectDelete.mockReset();

    mocks.logActivity.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.redirect.mockReset();

    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          project: {
            findMany: typeof mocks.projectFindMany;
            findFirst: typeof mocks.projectFindFirst;
            create: typeof mocks.projectCreate;
            updateMany: typeof mocks.projectUpdateMany;
            delete: typeof mocks.projectDelete;
          };
        }) => Promise<unknown>,
      ) => {
        return callback({
          project: {
            findMany: mocks.projectFindMany,
            findFirst: mocks.projectFindFirst,
            create: mocks.projectCreate,
            updateMany: mocks.projectUpdateMany,
            delete: mocks.projectDelete,
          },
        });
      },
    );

    mocks.projectFindMany.mockResolvedValue([
      createProject({
        id: "active-project",
        name: "Active Project",
        archived: false,
      }),
      createProject({
        id: "archived-project",
        name: "Archived Project",
        archived: true,
      }),
    ]);

    mocks.logActivity.mockResolvedValue(undefined);
  });

  it("shows archive and restore controls to owners and admins but not members", async () => {
    const ownerTree = await renderProjectsPage("OWNER");

    expect(
      collectElements(ownerTree).some(
        (element) =>
          element.type === "form" &&
          hasHiddenInput(element, "projectId", "active-project") &&
          getButtonText(element) === "Archive",
      ),
    ).toBe(true);

    expect(
      collectElements(ownerTree).some(
        (element) =>
          element.type === "form" &&
          hasHiddenInput(element, "projectId", "archived-project") &&
          getButtonText(element) === "Restore",
      ),
    ).toBe(true);

    const adminTree = await renderProjectsPage("ADMIN");

    expect(
      collectElements(adminTree).some(
        (element) => getButtonText(element) === "Archive",
      ),
    ).toBe(true);

    expect(
      collectElements(adminTree).some(
        (element) => getButtonText(element) === "Restore",
      ),
    ).toBe(true);

    const memberTree = await renderProjectsPage("MEMBER");

    expect(
      collectElements(memberTree).some(
        (element) => getButtonText(element) === "Archive",
      ),
    ).toBe(false);

    expect(
      collectElements(memberTree).some(
        (element) => getButtonText(element) === "Restore",
      ),
    ).toBe(false);
  });

  it("requires OWNER or ADMIN authorization before archiving", async () => {
    const tree = await renderProjectsPage("OWNER");

    const archiveAction = getProjectAction(
      tree,
      "active-project",
      "Archive",
    );

    mocks.requireWorkspaceRole.mockRejectedValue(
      new Error("PROJECT_MANAGEMENT_FORBIDDEN"),
    );

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("projectId", "active-project");

    await expect(archiveAction(formData)).rejects.toThrow(
      "PROJECT_MANAGEMENT_FORBIDDEN",
    );

    expect(mocks.requireWorkspaceRole).toHaveBeenCalledWith(
      "workspace-a",
      ["OWNER", "ADMIN"],
    );

    expect(mocks.projectFindFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled();
    expect(mocks.projectDelete).not.toHaveBeenCalled();
  });

  it("refuses to archive a project from another workspace", async () => {
    const tree = await renderProjectsPage("OWNER");

    const archiveAction = getProjectAction(
      tree,
      "active-project",
      "Archive",
    );

    mocks.projectFindFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("projectId", "project-from-workspace-b");

    await expect(archiveAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/projects?error=project-not-found",
    );

    expect(mocks.projectFindFirst).toHaveBeenCalledWith({
      where: {
        id: "project-from-workspace-b",
        workspaceId: "workspace-a",
      },
      select: {
        id: true,
        name: true,
        archived: true,
      },
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled();
    expect(mocks.projectDelete).not.toHaveBeenCalled();
  });

  it("archives a project by toggling archived instead of deleting it", async () => {
    const tree = await renderProjectsPage("OWNER");

    const archiveAction = getProjectAction(
      tree,
      "active-project",
      "Archive",
    );

    mocks.projectFindFirst.mockResolvedValue({
      id: "active-project",
      name: "Active Project",
      archived: false,
    });

    mocks.projectUpdateMany.mockResolvedValue({
      count: 1,
    });

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("projectId", "active-project");

    await expect(archiveAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/projects?success=project-archived",
    );

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.projectUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "active-project",
        workspaceId: "workspace-a",
        archived: false,
      },
      data: {
        archived: true,
      },
    });

    expect(mocks.projectDelete).not.toHaveBeenCalled();

    expect(mocks.logActivity).toHaveBeenCalledWith(
      {
        workspaceId: "workspace-a",
        userId: "user-1",
        projectId: "active-project",
        action: "project.archived",
        description: 'Archived project "Active Project".',
        metadata: {
          projectId: "active-project",
          projectName: "Active Project",
        },
      },
      expect.objectContaining({
        project: expect.any(Object),
      }),
    );
  });

  it("does not rewrite or relog a project that is already archived", async () => {
    const tree = await renderProjectsPage("OWNER");

    const archiveAction = getProjectAction(
      tree,
      "active-project",
      "Archive",
    );

    mocks.projectFindFirst.mockResolvedValue({
      id: "active-project",
      name: "Active Project",
      archived: true,
    });

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("projectId", "active-project");

    await expect(archiveAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/projects?success=project-archived",
    );

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled();
    expect(mocks.projectDelete).not.toHaveBeenCalled();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("restores an archived project by toggling archived back to false", async () => {
    const tree = await renderProjectsPage("OWNER");

    const restoreAction = getProjectAction(
      tree,
      "archived-project",
      "Restore",
    );

    mocks.projectFindFirst.mockResolvedValue({
      id: "archived-project",
      name: "Archived Project",
      archived: true,
    });

    mocks.projectUpdateMany.mockResolvedValue({
      count: 1,
    });

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("projectId", "archived-project");

    await expect(restoreAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/projects?success=project-restored",
    );

    expect(mocks.requireWorkspaceRole).toHaveBeenCalledWith(
      "workspace-a",
      ["OWNER", "ADMIN"],
    );

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.projectUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "archived-project",
        workspaceId: "workspace-a",
        archived: true,
      },
      data: {
        archived: false,
      },
    });

    expect(mocks.projectDelete).not.toHaveBeenCalled();

    expect(mocks.logActivity).toHaveBeenCalledWith(
      {
        workspaceId: "workspace-a",
        userId: "user-1",
        projectId: "archived-project",
        action: "project.restored",
        description: 'Restored project "Archived Project".',
        metadata: {
          projectId: "archived-project",
          projectName: "Archived Project",
        },
      },
      expect.objectContaining({
        project: expect.any(Object),
      }),
    );
  });

  it("refuses to restore a project from another workspace", async () => {
    const tree = await renderProjectsPage("OWNER");

    const restoreAction = getProjectAction(
      tree,
      "archived-project",
      "Restore",
    );

    mocks.projectFindFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("projectId", "project-from-workspace-b");

    await expect(restoreAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/projects?error=project-not-found",
    );

    expect(mocks.projectFindFirst).toHaveBeenCalledWith({
      where: {
        id: "project-from-workspace-b",
        workspaceId: "workspace-a",
      },
      select: {
        id: true,
        name: true,
        archived: true,
      },
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled();
    expect(mocks.projectDelete).not.toHaveBeenCalled();
  });

  it("does not rewrite or relog a project that is already active", async () => {
    const tree = await renderProjectsPage("OWNER");

    const restoreAction = getProjectAction(
      tree,
      "archived-project",
      "Restore",
    );

    mocks.projectFindFirst.mockResolvedValue({
      id: "archived-project",
      name: "Archived Project",
      archived: false,
    });

    const formData = new FormData();
    formData.set("workspaceId", "workspace-a");
    formData.set("projectId", "archived-project");

    await expect(restoreAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/workspace-a/projects?success=project-restored",
    );

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled();
    expect(mocks.projectDelete).not.toHaveBeenCalled();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });
});
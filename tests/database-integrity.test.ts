import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  disconnectTestDatabase,
  resetTestDatabase,
  testPrisma,
} from "./helpers/test-db";

describe("database integrity", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await resetTestDatabase();
    await disconnectTestDatabase();
  });

  it("prevents duplicate memberships for the same user and workspace", async () => {
    const user = await testPrisma.user.create({
      data: {
        clerkId: "clerk-duplicate-membership",
        email: "duplicate-membership@example.com",
        name: "Duplicate Membership User",
      },
    });

    const workspace = await testPrisma.workspace.create({
      data: {
        name: "Membership Integrity Workspace",
      },
    });

    await testPrisma.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "MEMBER",
      },
    });

    await expect(
      testPrisma.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "ADMIN",
        },
      }),
    ).rejects.toThrow();

    const memberships = await testPrisma.membership.findMany({
      where: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    });

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe("MEMBER");
  });

  it("keeps tenant-scoped issue queries isolated by workspace", async () => {
    const workspaceA = await testPrisma.workspace.create({
      data: {
        name: "Workspace A",
      },
    });

    const workspaceB = await testPrisma.workspace.create({
      data: {
        name: "Workspace B",
      },
    });

    const projectA = await testPrisma.project.create({
      data: {
        name: "Project A",
        workspaceId: workspaceA.id,
      },
    });

    const projectB = await testPrisma.project.create({
      data: {
        name: "Project B",
        workspaceId: workspaceB.id,
      },
    });

    await testPrisma.issue.create({
      data: {
        title: "Workspace A issue",
        workspaceId: workspaceA.id,
        projectId: projectA.id,
      },
    });

    await testPrisma.issue.create({
      data: {
        title: "Workspace B issue",
        workspaceId: workspaceB.id,
        projectId: projectB.id,
      },
    });

    const workspaceAIssues = await testPrisma.issue.findMany({
      where: {
        workspaceId: workspaceA.id,
      },
      orderBy: {
        title: "asc",
      },
    });

    expect(workspaceAIssues).toHaveLength(1);
    expect(workspaceAIssues[0]?.title).toBe("Workspace A issue");
    expect(workspaceAIssues[0]?.workspaceId).toBe(workspaceA.id);
    expect(workspaceAIssues[0]?.workspaceId).not.toBe(workspaceB.id);
  });

  it("cascades workspace deletion through workspace-owned records", async () => {
    const user = await testPrisma.user.create({
      data: {
        clerkId: "clerk-cascade-test",
        email: "cascade-test@example.com",
        name: "Cascade Test User",
      },
    });

    const workspace = await testPrisma.workspace.create({
      data: {
        name: "Cascade Workspace",
      },
    });

    await testPrisma.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "OWNER",
      },
    });

    const project = await testPrisma.project.create({
      data: {
        name: "Cascade Project",
        workspaceId: workspace.id,
      },
    });

    await testPrisma.issue.create({
      data: {
        title: "Cascade Issue",
        workspaceId: workspace.id,
        projectId: project.id,
        reporterId: user.id,
      },
    });

    await testPrisma.workspace.delete({
      where: {
        id: workspace.id,
      },
    });

    const membershipCount = await testPrisma.membership.count({
      where: {
        workspaceId: workspace.id,
      },
    });

    const projectCount = await testPrisma.project.count({
      where: {
        workspaceId: workspace.id,
      },
    });

    const issueCount = await testPrisma.issue.count({
      where: {
        workspaceId: workspace.id,
      },
    });

    expect(membershipCount).toBe(0);
    expect(projectCount).toBe(0);
    expect(issueCount).toBe(0);
  });
});
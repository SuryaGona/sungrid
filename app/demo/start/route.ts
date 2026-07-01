import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUEST_COOKIE_NAME = "sungrid_guest_user_id";
const GUEST_DURATION_MS = 60 * 60 * 1000;

function createGuestToken() {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function GET(req: Request) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + GUEST_DURATION_MS);
  const token = createGuestToken();

  const result = await prisma.$transaction(async (tx) => {
    await tx.workspace.deleteMany({
      where: {
        isGuest: true,
        expiresAt: {
          lt: now,
        },
      },
    });

    await tx.user.deleteMany({
      where: {
        isGuest: true,
        memberships: {
          none: {},
        },
      },
    });

    const guestUser = await tx.user.create({
      data: {
        clerkId: `guest_${token}`,
        email: `guest-${token}@sungrid.demo`,
        name: "Guest Reviewer",
        imageUrl: null,
        isGuest: true,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: "Guest Demo Workspace",
        slug: `guest-demo-${token}`,
        description:
          "Temporary SunGrid demo workspace for exploring projects, issues, sprints, and activity.",
        isGuest: true,
        expiresAt,
        memberships: {
          create: {
            userId: guestUser.id,
            role: "OWNER",
          },
        },
      },
    });

    const launchProject = await tx.project.create({
      data: {
        name: "Product Launch",
        description:
          "Plan the launch workflow, track delivery work, and prepare the team for release.",
        workspaceId: workspace.id,
      },
    });

    const platformProject = await tx.project.create({
      data: {
        name: "Platform Improvements",
        description:
          "Improve the core product experience, dashboard quality, and workspace reliability.",
        workspaceId: workspace.id,
      },
    });

    const analyticsProject = await tx.project.create({
      data: {
        name: "Analytics Upgrade",
        description:
          "Add clearer reporting around sprints, issue progress, and team activity.",
        workspaceId: workspace.id,
      },
    });

    const sprint = await tx.sprint.create({
      data: {
        name: "Launch Sprint 01",
        goal: "Finish the core launch flow and clean up the dashboard experience.",
        status: "ACTIVE",
        startDate: now,
        endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        workspaceId: workspace.id,
        projectId: launchProject.id,
      },
    });

    const issues = await Promise.all([
      tx.issue.create({
        data: {
          title: "Finalize launch checklist",
          description:
            "Review remaining release tasks and make sure the workspace is ready for demo users.",
          status: "IN_PROGRESS",
          priority: "HIGH",
          type: "TASK",
          storyPoints: 5,
          position: 1000,
          workspaceId: workspace.id,
          projectId: launchProject.id,
          sprintId: sprint.id,
          reporterId: guestUser.id,
          assigneeId: guestUser.id,
        },
      }),

      tx.issue.create({
        data: {
          title: "Fix board drag persistence",
          description:
            "Confirm issue movement between columns stays saved after refresh.",
          status: "REVIEW",
          priority: "HIGH",
          type: "BUG",
          storyPoints: 3,
          position: 1000,
          workspaceId: workspace.id,
          projectId: launchProject.id,
          sprintId: sprint.id,
          reporterId: guestUser.id,
          assigneeId: guestUser.id,
        },
      }),

      tx.issue.create({
        data: {
          title: "Create guest demo sandbox",
          description:
            "Let reviewers explore SunGrid without signing in or connecting a Google account.",
          status: "TODO",
          priority: "URGENT",
          type: "FEATURE",
          storyPoints: 8,
          position: 1000,
          workspaceId: workspace.id,
          projectId: launchProject.id,
          sprintId: sprint.id,
          reporterId: guestUser.id,
          assigneeId: guestUser.id,
        },
      }),

      tx.issue.create({
        data: {
          title: "Polish dashboard empty states",
          description:
            "Make project, issue, and sprint pages feel clean when data is missing.",
          status: "BACKLOG",
          priority: "MEDIUM",
          type: "TASK",
          storyPoints: 3,
          position: 1000,
          workspaceId: workspace.id,
          projectId: platformProject.id,
          reporterId: guestUser.id,
          assigneeId: guestUser.id,
        },
      }),

      tx.issue.create({
        data: {
          title: "Improve activity timeline",
          description:
            "Make recent project changes easier to scan for admins and owners.",
          status: "DONE",
          priority: "MEDIUM",
          type: "STORY",
          storyPoints: 5,
          position: 1000,
          workspaceId: workspace.id,
          projectId: platformProject.id,
          reporterId: guestUser.id,
          assigneeId: guestUser.id,
        },
      }),

      tx.issue.create({
        data: {
          title: "Add sprint completion report",
          description:
            "Generate a summary when a sprint is completed, including completion rate and velocity.",
          status: "DONE",
          priority: "HIGH",
          type: "FEATURE",
          storyPoints: 8,
          position: 1000,
          workspaceId: workspace.id,
          projectId: analyticsProject.id,
          reporterId: guestUser.id,
          assigneeId: guestUser.id,
        },
      }),

      tx.issue.create({
        data: {
          title: "Show issue breakdown by priority",
          description:
            "Display active issue counts by priority on the analytics page.",
          status: "IN_PROGRESS",
          priority: "LOW",
          type: "TASK",
          storyPoints: 2,
          position: 1000,
          workspaceId: workspace.id,
          projectId: analyticsProject.id,
          reporterId: guestUser.id,
          assigneeId: guestUser.id,
        },
      }),
    ]);

    const completedIssues = issues.filter((issue) => issue.status === "DONE");
    const sprintIssues = issues.filter((issue) => issue.sprintId === sprint.id);
    const sprintCompletedIssues = sprintIssues.filter(
      (issue) => issue.status === "DONE",
    );

    await tx.sprintReport.create({
      data: {
        workspaceId: workspace.id,
        sprintId: sprint.id,
        totalIssues: sprintIssues.length,
        completedIssues: sprintCompletedIssues.length,
        completionRate:
          sprintIssues.length > 0
            ? Math.round((sprintCompletedIssues.length / sprintIssues.length) * 100)
            : 0,
        velocity: sprintCompletedIssues.reduce(
          (total, issue) => total + (issue.storyPoints || 0),
          0,
        ),
        burndownData: [
          { day: "Mon", remaining: 5 },
          { day: "Tue", remaining: 4 },
          { day: "Wed", remaining: 3 },
          { day: "Thu", remaining: 2 },
          { day: "Fri", remaining: 2 },
        ],
        generatedSummary:
          "The launch sprint is active with several core workflow items in progress. Review the board, move issues, and complete the sprint to see reporting behavior.",
      },
    });

    await tx.activityLog.createMany({
      data: [
        {
          workspaceId: workspace.id,
          userId: guestUser.id,
          projectId: launchProject.id,
          action: "workspace.created",
          description: "Guest demo workspace created.",
          metadata: {
            mode: "guest",
            expiresAt: expiresAt.toISOString(),
          },
        },
        {
          workspaceId: workspace.id,
          userId: guestUser.id,
          projectId: launchProject.id,
          sprintId: sprint.id,
          action: "sprint.started",
          description: "Launch Sprint 01 started.",
          metadata: {
            sprintName: sprint.name,
          },
        },
        {
          workspaceId: workspace.id,
          userId: guestUser.id,
          projectId: analyticsProject.id,
          action: "report.generated",
          description: "Sprint report generated for demo analytics.",
          metadata: {
            completedIssues: completedIssues.length,
            totalIssues: issues.length,
          },
        },
      ],
    });

    return {
      guestUserId: guestUser.id,
      workspaceId: workspace.id,
      expiresAt,
    };
  });

  const redirectUrl = new URL(`/dashboard/${result.workspaceId}`, req.url);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set(GUEST_COOKIE_NAME, result.guestUserId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: result.expiresAt,
  });

  return response;
}
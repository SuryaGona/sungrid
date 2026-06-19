import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
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

type SprintsPageProps = {
  params: Promise<{
    workspaceId: string;
    projectId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

const createSprintSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  goal: z.string().trim().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const sprintActionSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  sprintId: z.string().min(1),
});

const sprintIssueActionSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  sprintId: z.string().min(1),
  issueId: z.string().min(1),
});

function sprintsPageUrl(
  workspaceId: string,
  projectId: string,
  params?: Record<string, string>,
) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();

  if (!query) {
    return `/dashboard/${workspaceId}/projects/${projectId}/sprints`;
  }

  return `/dashboard/${workspaceId}/projects/${projectId}/sprints?${query}`;
}

function getMessage(value: string | undefined) {
  if (!value) {
    return null;
  }

  const messages: Record<string, string> = {
    "invalid-sprint": "Sprint name is required and must be 80 characters or less.",
    "project-not-found": "Project not found.",
    "project-archived": "Archived projects cannot be changed.",
    "sprint-not-found": "Sprint not found.",
    "issue-not-found": "Issue not found.",
    "issue-already-assigned": "That issue is already assigned to this sprint.",
    "completed-sprint-locked": "Completed sprints are locked because they preserve reports and history.",
    "active-sprint-exists": "This project already has an active sprint.",
    "sprint-created": "Sprint created successfully.",
    "sprint-started": "Sprint started successfully.",
    "sprint-completed": "Sprint completed and report generated.",
    "sprint-cancelled": "Sprint cancelled successfully.",
    "issue-added": "Issue added to sprint.",
    "issue-removed": "Issue removed from sprint.",
    database: "SunGrid could not complete that sprint action.",
  };

  return messages[value] ?? null;
}

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return date.toLocaleDateString();
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTypeLabel(type: string) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function getPriorityLabel(priority: string) {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function getCompletionRate(totalIssues: number, completedIssues: number) {
  if (totalIssues === 0) {
    return 0;
  }

  return Math.round((completedIssues / totalIssues) * 100);
}

function getSprintMetrics(
  issues: {
    status: string;
    storyPoints: number | null;
  }[],
) {
  const completedIssues = issues.filter((issue) => issue.status === "DONE");

  const totalPoints = issues.reduce((total, issue) => {
    return total + (issue.storyPoints ?? 0);
  }, 0);

  const velocity = completedIssues.reduce((total, issue) => {
    return total + (issue.storyPoints ?? 0);
  }, 0);

  const completionRate = getCompletionRate(issues.length, completedIssues.length);

  return {
    completedIssues,
    totalPoints,
    velocity,
    completionRate,
  };
}

async function createSprint(formData: FormData) {
  "use server";

  const workspaceId = String(formData.get("workspaceId") || "");
  const projectId = String(formData.get("projectId") || "");

  if (!workspaceId || !projectId) {
    redirect("/dashboard");
  }

  const parsed = createSprintSchema.safeParse({
    workspaceId,
    projectId,
    name: formData.get("name"),
    goal: formData.get("goal"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });

  if (!parsed.success) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "invalid-sprint" }));
  }

  const { user } = await requireWorkspaceRole(workspaceId, [
    "OWNER",
    "ADMIN",
  ]);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
  });

  if (!project) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "project-not-found" }));
  }

  if (project.archived) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }));
  }

  try {
    const sprint = await prisma.sprint.create({
      data: {
        workspaceId,
        projectId,
        name: parsed.data.name,
        goal: parsed.data.goal || null,
        startDate: parseDate(parsed.data.startDate),
        endDate: parseDate(parsed.data.endDate),
      },
    });

    await logActivity({
      workspaceId,
      userId: user.id,
      projectId,
      sprintId: sprint.id,
      action: "sprint.created",
      description: `Created sprint "${sprint.name}" in project "${project.name}".`,
      metadata: {
        sprintId: sprint.id,
        sprintName: sprint.name,
        projectId,
        projectName: project.name,
      },
    });
  } catch (error) {
    console.error("Create sprint failed:", error);
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "database" }));
  }

  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(sprintsPageUrl(workspaceId, projectId, { success: "sprint-created" }));
}

async function startSprint(formData: FormData) {
  "use server";

  const parsed = sprintActionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    projectId: formData.get("projectId"),
    sprintId: formData.get("sprintId"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { workspaceId, projectId, sprintId } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, [
    "OWNER",
    "ADMIN",
  ]);

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      workspaceId,
      projectId,
    },
    include: {
      project: true,
    },
  });

  if (!sprint) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "sprint-not-found" }));
  }

  if (sprint.project.archived) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }));
  }

  if (sprint.status === "COMPLETED") {
    redirect(
      sprintsPageUrl(workspaceId, projectId, {
        error: "completed-sprint-locked",
      }),
    );
  }

  const activeSprint = await prisma.sprint.findFirst({
    where: {
      workspaceId,
      projectId,
      status: "ACTIVE",
      NOT: {
        id: sprintId,
      },
    },
  });

  if (activeSprint) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, {
        error: "active-sprint-exists",
      }),
    );
  }

  await prisma.sprint.update({
    where: {
      id: sprint.id,
    },
    data: {
      status: "ACTIVE",
      startDate: sprint.startDate ?? new Date(),
    },
  });

  await logActivity({
    workspaceId,
    userId: user.id,
    projectId,
    sprintId: sprint.id,
    action: "sprint.started",
    description: `Started sprint "${sprint.name}".`,
    metadata: {
      sprintId: sprint.id,
      sprintName: sprint.name,
      projectId,
      projectName: sprint.project.name,
    },
  });

  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(sprintsPageUrl(workspaceId, projectId, { success: "sprint-started" }));
}

async function completeSprint(formData: FormData) {
  "use server";

  const parsed = sprintActionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    projectId: formData.get("projectId"),
    sprintId: formData.get("sprintId"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { workspaceId, projectId, sprintId } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, [
    "OWNER",
    "ADMIN",
  ]);

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      workspaceId,
      projectId,
    },
    include: {
      project: true,
      issues: {
        where: {
          archived: false,
        },
        select: {
          id: true,
          title: true,
          status: true,
          storyPoints: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!sprint) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "sprint-not-found" }));
  }

  if (sprint.project.archived) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }));
  }

  if (sprint.status === "COMPLETED") {
    redirect(
      sprintsPageUrl(workspaceId, projectId, {
        error: "completed-sprint-locked",
      }),
    );
  }

  const completedIssues = sprint.issues.filter(
    (issue) => issue.status === "DONE",
  );

  const totalIssues = sprint.issues.length;

  const totalPoints = sprint.issues.reduce((total, issue) => {
    return total + (issue.storyPoints ?? 0);
  }, 0);

  const velocity = completedIssues.reduce((total, issue) => {
    return total + (issue.storyPoints ?? 0);
  }, 0);

  const completionRate = getCompletionRate(totalIssues, completedIssues.length);
  const completedAt = new Date();

  const burndownData = {
    generatedAt: completedAt.toISOString(),
    sprintId: sprint.id,
    sprintName: sprint.name,
    projectId,
    projectName: sprint.project.name,
    startDate: sprint.startDate?.toISOString() ?? null,
    endDate: sprint.endDate?.toISOString() ?? null,
    completedAt: completedAt.toISOString(),
    totalIssues,
    completedIssues: completedIssues.length,
    remainingIssues: Math.max(totalIssues - completedIssues.length, 0),
    totalPoints,
    velocity,
    issues: sprint.issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      status: issue.status,
      storyPoints: issue.storyPoints ?? 0,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
    })),
  };

  const generatedSummary = `Sprint "${sprint.name}" completed with ${completedIssues.length}/${totalIssues} issues done (${completionRate}%). Velocity: ${velocity} story points.`;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.sprint.update({
        where: {
          id: sprint.id,
        },
        data: {
          status: "COMPLETED",
          completedAt,
        },
      });

      await tx.sprintReport.upsert({
        where: {
          sprintId: sprint.id,
        },
        update: {
          totalIssues,
          completedIssues: completedIssues.length,
          completionRate,
          velocity,
          burndownData,
          generatedSummary,
        },
        create: {
          workspaceId,
          sprintId: sprint.id,
          totalIssues,
          completedIssues: completedIssues.length,
          completionRate,
          velocity,
          burndownData,
          generatedSummary,
        },
      });
    });

    await logActivity({
      workspaceId,
      userId: user.id,
      projectId,
      sprintId: sprint.id,
      action: "sprint.completed",
      description: `Completed sprint "${sprint.name}" and generated its report.`,
      metadata: {
        sprintId: sprint.id,
        sprintName: sprint.name,
        projectId,
        projectName: sprint.project.name,
        totalIssues,
        completedIssues: completedIssues.length,
        completionRate,
        totalPoints,
        velocity,
      },
    });
  } catch (error) {
    console.error("Complete sprint failed:", error);
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "database" }));
  }

  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(
    sprintsPageUrl(workspaceId, projectId, {
      success: "sprint-completed",
    }),
  );
}

async function cancelSprint(formData: FormData) {
  "use server";

  const parsed = sprintActionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    projectId: formData.get("projectId"),
    sprintId: formData.get("sprintId"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { workspaceId, projectId, sprintId } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, [
    "OWNER",
    "ADMIN",
  ]);

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      workspaceId,
      projectId,
    },
    include: {
      project: true,
      issues: {
        where: {
          archived: false,
        },
        select: {
          id: true,
        },
      },
      sprintReport: true,
    },
  });

  if (!sprint) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "sprint-not-found" }));
  }

  if (sprint.project.archived) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }));
  }

  if (sprint.status === "COMPLETED" || sprint.sprintReport) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, {
        error: "completed-sprint-locked",
      }),
    );
  }

  try {
    await logActivity({
      workspaceId,
      userId: user.id,
      projectId,
      sprintId: sprint.id,
      action: "sprint.cancelled",
      description: `Cancelled sprint "${sprint.name}".`,
      metadata: {
        sprintId: sprint.id,
        sprintName: sprint.name,
        projectId,
        projectName: sprint.project.name,
        removedIssueLinks: sprint.issues.length,
      },
    });

    await prisma.sprint.delete({
      where: {
        id: sprint.id,
      },
    });
  } catch (error) {
    console.error("Cancel sprint failed:", error);
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "database" }));
  }

  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/board`);
  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(
    sprintsPageUrl(workspaceId, projectId, {
      success: "sprint-cancelled",
    }),
  );
}

async function addIssueToSprint(formData: FormData) {
  "use server";

  const parsed = sprintIssueActionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    projectId: formData.get("projectId"),
    sprintId: formData.get("sprintId"),
    issueId: formData.get("issueId"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { workspaceId, projectId, sprintId, issueId } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, [
    "OWNER",
    "ADMIN",
  ]);

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      workspaceId,
      projectId,
    },
    include: {
      project: true,
    },
  });

  if (!sprint) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "sprint-not-found" }));
  }

  if (sprint.status === "COMPLETED") {
    redirect(
      sprintsPageUrl(workspaceId, projectId, {
        error: "completed-sprint-locked",
      }),
    );
  }

  if (sprint.project.archived) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }));
  }

  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      workspaceId,
      projectId,
      archived: false,
    },
    select: {
      id: true,
      title: true,
      sprintId: true,
    },
  });

  if (!issue) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "issue-not-found" }));
  }

  if (issue.sprintId === sprint.id) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, {
        error: "issue-already-assigned",
      }),
    );
  }

  await prisma.issue.updateMany({
    where: {
      id: issue.id,
      workspaceId,
      projectId,
    },
    data: {
      sprintId: sprint.id,
    },
  });

  await logActivity({
    workspaceId,
    userId: user.id,
    projectId,
    sprintId: sprint.id,
    issueId: issue.id,
    action: "sprint.issue_added",
    description: `Added issue "${issue.title}" to sprint "${sprint.name}".`,
    metadata: {
      issueId: issue.id,
      issueTitle: issue.title,
      sprintId: sprint.id,
      sprintName: sprint.name,
      projectId,
      projectName: sprint.project.name,
    },
  });

  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/board`);
  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(sprintsPageUrl(workspaceId, projectId, { success: "issue-added" }));
}

async function removeIssueFromSprint(formData: FormData) {
  "use server";

  const parsed = sprintIssueActionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    projectId: formData.get("projectId"),
    sprintId: formData.get("sprintId"),
    issueId: formData.get("issueId"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { workspaceId, projectId, sprintId, issueId } = parsed.data;

  const { user } = await requireWorkspaceRole(workspaceId, [
    "OWNER",
    "ADMIN",
  ]);

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      workspaceId,
      projectId,
    },
    include: {
      project: true,
    },
  });

  if (!sprint) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "sprint-not-found" }));
  }

  if (sprint.status === "COMPLETED") {
    redirect(
      sprintsPageUrl(workspaceId, projectId, {
        error: "completed-sprint-locked",
      }),
    );
  }

  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      workspaceId,
      projectId,
      sprintId,
      archived: false,
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!issue) {
    redirect(sprintsPageUrl(workspaceId, projectId, { error: "issue-not-found" }));
  }

  await prisma.issue.updateMany({
    where: {
      id: issue.id,
      workspaceId,
      projectId,
      sprintId,
    },
    data: {
      sprintId: null,
    },
  });

  await logActivity({
    workspaceId,
    userId: user.id,
    projectId,
    sprintId: sprint.id,
    issueId: issue.id,
    action: "sprint.issue_removed",
    description: `Removed issue "${issue.title}" from sprint "${sprint.name}".`,
    metadata: {
      issueId: issue.id,
      issueTitle: issue.title,
      sprintId: sprint.id,
      sprintName: sprint.name,
      projectId,
      projectName: sprint.project.name,
    },
  });

  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/sprints`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}`);
  revalidatePath(`/dashboard/${workspaceId}/projects/${projectId}/board`);
  revalidatePath(`/dashboard/${workspaceId}`);
  revalidatePath(`/dashboard/${workspaceId}/activity`);
  revalidatePath(`/dashboard/${workspaceId}/analytics`);

  redirect(sprintsPageUrl(workspaceId, projectId, { success: "issue-removed" }));
}

export default async function SprintsPage({
  params,
  searchParams,
}: SprintsPageProps) {
  const { workspaceId, projectId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const errorMessage = getMessage(resolvedSearchParams.error);
  const successMessage = getMessage(resolvedSearchParams.success);

  const { workspace, membership } = await requireWorkspaceAccess(workspaceId);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
  });

  if (!project) {
    redirect(`/dashboard/${workspaceId}/projects?error=project-not-found`);
  }

  const canManageSprints =
    membership.role === "OWNER" || membership.role === "ADMIN";

  const [sprints, unassignedIssues] = await Promise.all([
    prisma.sprint.findMany({
      where: {
        workspaceId,
        projectId,
      },
      include: {
        sprintReport: true,
        issues: {
          where: {
            archived: false,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            storyPoints: true,
          },
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
    }),

    prisma.issue.findMany({
      where: {
        workspaceId,
        projectId,
        archived: false,
        sprintId: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        type: true,
        storyPoints: true,
      },
    }),
  ]);

  const plannedSprints = sprints.filter((sprint) => sprint.status === "PLANNED");
  const activeSprints = sprints.filter((sprint) => sprint.status === "ACTIVE");
  const completedSprints = sprints.filter(
    (sprint) => sprint.status === "COMPLETED",
  );

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
        <DashboardSidebar workspaceId={workspaceId} activePage="projects" />

        <section className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}`}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← Back to project
            </Link>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Sprint planning
                </p>

                <h2 className="mt-2 text-3xl font-bold text-gray-900">
                  {project.name} sprints
                </h2>

                <p className="mt-2 text-gray-600">
                  Plan, start, assign work, complete delivery cycles, and
                  generate sprint reports for this project.
                </p>
              </div>

              {project.archived ? (
                <span className="rounded-full bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700">
                  Project archived
                </span>
              ) : (
                <span className="rounded-full bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                  Active project
                </span>
              )}
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
              <p className="text-sm text-gray-500">Planned</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {plannedSprints.length}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Active</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {activeSprints.length}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Completed</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {completedSprints.length}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Unassigned issues</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {unassignedIssues.length}
              </p>
            </div>
          </div>

          {canManageSprints && !project.archived ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">
                Create sprint
              </h3>

              <form action={createSprint} className="mt-5 space-y-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="projectId" value={projectId} />

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Sprint name
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    maxLength={80}
                    placeholder="Sprint 1"
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="goal"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Goal
                  </label>

                  <textarea
                    id="goal"
                    name="goal"
                    rows={3}
                    maxLength={500}
                    placeholder="What should this sprint accomplish?"
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="startDate"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Start date
                    </label>

                    <input
                      id="startDate"
                      name="startDate"
                      type="date"
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="endDate"
                      className="block text-sm font-medium text-gray-700"
                    >
                      End date
                    </label>

                    <input
                      id="endDate"
                      name="endDate"
                      type="date"
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  Create sprint
                </button>
              </form>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Sprints</h3>

              <p className="mt-1 text-sm text-gray-600">
                Planned, active, and completed sprint cycles for this project.
              </p>
            </div>

            {sprints.length === 0 ? (
              <div className="p-6">
                <p className="text-sm text-gray-600">
                  No sprints yet. Create the first sprint to start planning
                  delivery cycles.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {sprints.map((sprint) => {
                  const {
                    completedIssues,
                    totalPoints,
                    velocity,
                    completionRate,
                  } = getSprintMetrics(sprint.issues);

                  const sprintLocked = sprint.status === "COMPLETED";

                  return (
                    <div key={sprint.id} className="p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-semibold text-gray-900">
                              {sprint.name}
                            </h4>

                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                              {formatStatus(sprint.status)}
                            </span>

                            {sprint.sprintReport ? (
                              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                Report generated
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-2 text-sm text-gray-600">
                            {sprint.goal || "No goal provided."}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                            <span className="rounded-full bg-gray-100 px-2 py-1">
                              Start: {formatDate(sprint.startDate)}
                            </span>

                            <span className="rounded-full bg-gray-100 px-2 py-1">
                              End: {formatDate(sprint.endDate)}
                            </span>

                            <span className="rounded-full bg-gray-100 px-2 py-1">
                              Issues: {sprint.issues.length}
                            </span>

                            <span className="rounded-full bg-gray-100 px-2 py-1">
                              Done: {completedIssues.length}
                            </span>

                            <span className="rounded-full bg-gray-100 px-2 py-1">
                              Points: {totalPoints}
                            </span>

                            <span className="rounded-full bg-gray-100 px-2 py-1">
                              Velocity: {velocity}
                            </span>

                            <span className="rounded-full bg-gray-100 px-2 py-1">
                              Completion: {completionRate}%
                            </span>
                          </div>
                        </div>

                        {canManageSprints && !project.archived ? (
                          <div className="flex flex-wrap gap-2">
                            {sprint.status === "PLANNED" ? (
                              <form action={startSprint}>
                                <input
                                  type="hidden"
                                  name="workspaceId"
                                  value={workspaceId}
                                />
                                <input
                                  type="hidden"
                                  name="projectId"
                                  value={projectId}
                                />
                                <input
                                  type="hidden"
                                  name="sprintId"
                                  value={sprint.id}
                                />

                                <button
                                  type="submit"
                                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  Start
                                </button>
                              </form>
                            ) : null}

                            {sprint.status === "ACTIVE" ? (
                              <form action={completeSprint}>
                                <input
                                  type="hidden"
                                  name="workspaceId"
                                  value={workspaceId}
                                />
                                <input
                                  type="hidden"
                                  name="projectId"
                                  value={projectId}
                                />
                                <input
                                  type="hidden"
                                  name="sprintId"
                                  value={sprint.id}
                                />

                                <button
                                  type="submit"
                                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  Complete
                                </button>
                              </form>
                            ) : null}

                            {sprint.status !== "COMPLETED" ? (
                              <form action={cancelSprint}>
                                <input
                                  type="hidden"
                                  name="workspaceId"
                                  value={workspaceId}
                                />
                                <input
                                  type="hidden"
                                  name="projectId"
                                  value={projectId}
                                />
                                <input
                                  type="hidden"
                                  name="sprintId"
                                  value={sprint.id}
                                />

                                <button
                                  type="submit"
                                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                                >
                                  Cancel sprint
                                </button>
                              </form>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {sprint.sprintReport ? (
                        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
                          <p className="text-sm font-semibold text-blue-950">
                            Sprint report
                          </p>

                          <p className="mt-2 text-sm leading-6 text-blue-900">
                            {sprint.sprintReport.generatedSummary ||
                              "Report generated for this completed sprint."}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-blue-800">
                            <span className="rounded-full bg-white/70 px-2 py-1">
                              Total: {sprint.sprintReport.totalIssues}
                            </span>
                            <span className="rounded-full bg-white/70 px-2 py-1">
                              Completed:{" "}
                              {sprint.sprintReport.completedIssues}
                            </span>
                            <span className="rounded-full bg-white/70 px-2 py-1">
                              Rate: {sprint.sprintReport.completionRate}%
                            </span>
                            <span className="rounded-full bg-white/70 px-2 py-1">
                              Velocity: {sprint.sprintReport.velocity}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50">
                        <div className="border-b border-gray-200 px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">
                            Sprint issues
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Work items assigned to this sprint.
                          </p>
                        </div>

                        {sprint.issues.length === 0 ? (
                          <div className="px-4 py-4 text-sm text-gray-500">
                            No issues assigned to this sprint yet.
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-200">
                            {sprint.issues.map((issue) => (
                              <div
                                key={issue.id}
                                className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {issue.title}
                                  </p>

                                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                    <span className="rounded-full bg-white px-2 py-1">
                                      {formatStatus(issue.status)}
                                    </span>
                                    <span className="rounded-full bg-white px-2 py-1">
                                      {getPriorityLabel(issue.priority)}
                                    </span>
                                    <span className="rounded-full bg-white px-2 py-1">
                                      {getTypeLabel(issue.type)}
                                    </span>
                                    <span className="rounded-full bg-white px-2 py-1">
                                      {issue.storyPoints ?? 0} pts
                                    </span>
                                  </div>
                                </div>

                                {canManageSprints &&
                                !project.archived &&
                                !sprintLocked ? (
                                  <form action={removeIssueFromSprint}>
                                    <input
                                      type="hidden"
                                      name="workspaceId"
                                      value={workspaceId}
                                    />
                                    <input
                                      type="hidden"
                                      name="projectId"
                                      value={projectId}
                                    />
                                    <input
                                      type="hidden"
                                      name="sprintId"
                                      value={sprint.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="issueId"
                                      value={issue.id}
                                    />

                                    <button
                                      type="submit"
                                      className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                                    >
                                      Remove
                                    </button>
                                  </form>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {canManageSprints &&
                      !project.archived &&
                      !sprintLocked &&
                      unassignedIssues.length > 0 ? (
                        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                          <p className="text-sm font-semibold text-gray-900">
                            Add an unassigned issue
                          </p>

                          <div className="mt-3 grid gap-3">
                            {unassignedIssues.map((issue) => (
                              <form
                                key={issue.id}
                                action={addIssueToSprint}
                                className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 md:flex-row md:items-center md:justify-between"
                              >
                                <input
                                  type="hidden"
                                  name="workspaceId"
                                  value={workspaceId}
                                />
                                <input
                                  type="hidden"
                                  name="projectId"
                                  value={projectId}
                                />
                                <input
                                  type="hidden"
                                  name="sprintId"
                                  value={sprint.id}
                                />
                                <input
                                  type="hidden"
                                  name="issueId"
                                  value={issue.id}
                                />

                                <div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {issue.title}
                                  </p>

                                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                    <span className="rounded-full bg-gray-100 px-2 py-1">
                                      {formatStatus(issue.status)}
                                    </span>
                                    <span className="rounded-full bg-gray-100 px-2 py-1">
                                      {getPriorityLabel(issue.priority)}
                                    </span>
                                    <span className="rounded-full bg-gray-100 px-2 py-1">
                                      {getTypeLabel(issue.type)}
                                    </span>
                                    <span className="rounded-full bg-gray-100 px-2 py-1">
                                      {issue.storyPoints ?? 0} pts
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="submit"
                                  className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
                                >
                                  Add to sprint
                                </button>
                              </form>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
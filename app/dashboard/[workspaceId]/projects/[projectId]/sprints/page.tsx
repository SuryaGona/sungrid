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

type SprintIssueCardData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  storyPoints: number | null;
  assignee: {
    name: string | null;
    email: string | null;
  } | null;
};

type SprintCardData = {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  completedAt: Date | null;
  sprintReport: {
    totalIssues: number;
    completedIssues: number;
    completionRate: number;
    velocity: number;
    generatedSummary: string | null;
  } | null;
  issues: SprintIssueCardData[];
};

const sprintDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Use a valid date.",
  });

const createSprintSchema = z
  .object({
    workspaceId: z.string().min(1),
    projectId: z.string().min(1),
    name: z.string().trim().min(1).max(80),
    goal: z.string().trim().max(500).optional(),
    startDate: sprintDateSchema,
    endDate: sprintDateSchema,
  })
  .superRefine((data, ctx) => {
    const startDate = parseDate(data.startDate);
    const endDate = parseDate(data.endDate);

    if (data.startDate && !startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Use a valid start date.",
      });
    }

    if (data.endDate && !endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Use a valid end date.",
      });
    }

    if (startDate && endDate && endDate < startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date cannot be before start date.",
      });
    }
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

const navCardClass =
  "min-w-0 rounded-[1.1rem] border border-white/10 bg-black/30 p-3.5 no-underline shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition hover:-translate-y-px hover:border-[#d6bf76]/15 hover:bg-white/[0.035] active:translate-y-0 active:scale-[0.99]";

const sprintCardClass =
  "rounded-[1.2rem] border border-white/10 bg-black/30 p-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition hover:border-[#d6bf76]/15 hover:bg-white/[0.035]";

const issueCardClass =
  "rounded-[1.1rem] border border-white/10 bg-black/30 p-3.5 transition hover:-translate-y-px hover:border-[#d6bf76]/15 hover:bg-white/[0.035]";

const badgeClass =
  "rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-white/55";

const actionButtonClass =
  "rounded-full border px-3.5 py-1.5 text-xs font-bold transition hover:-translate-y-px active:translate-y-0 active:scale-[0.98]";

const primaryButtonClass =
  "w-fit rounded-full border border-[#d6bf76]/25 bg-[#d6bf76]/[0.12] px-4 py-2 text-sm font-extrabold text-[#f4e7b0] transition hover:-translate-y-px hover:bg-[#d6bf76]/[0.18] hover:text-white active:translate-y-0 active:scale-[0.98]";

const fieldClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d6bf76]/60";

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

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
    "invalid-sprint":
      "Sprint name is required and must be 80 characters or less. Dates must be valid, and the end date cannot be before the start date.",
    "project-not-found": "Project not found.",
    "project-archived": "Archived projects cannot be changed.",
    "sprint-not-found": "Sprint not found.",
    "issue-not-found": "Issue not found.",
    "issue-already-assigned": "That issue is already assigned to this sprint.",
    "completed-sprint-locked":
      "Completed sprints are locked because they preserve reports and history.",
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function getAssigneeLabel(issue: SprintIssueCardData) {
  return issue.assignee?.name || issue.assignee?.email || "Unassigned";
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

  const completionRate = getCompletionRate(
    issues.length,
    completedIssues.length,
  );

  return {
    completedIssues,
    totalPoints,
    velocity,
    completionRate,
  };
}

function getSprintStatusClass(status: string) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
    case "COMPLETED":
      return "border-white/10 bg-white/[0.06] text-white/60";
    default:
      return "border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] text-[#f4e7b0]";
  }
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
    goal: String(formData.get("goal") || ""),
    startDate: String(formData.get("startDate") || ""),
    endDate: String(formData.get("endDate") || ""),
  });

  if (!parsed.success) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "invalid-sprint" }),
    );
  }

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN"]);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
    select: {
      id: true,
      name: true,
      archived: true,
    },
  });

  if (!project) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "project-not-found" }),
    );
  }

  if (project.archived) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }),
    );
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
      select: {
        id: true,
        name: true,
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

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN"]);

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      workspaceId,
      projectId,
    },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      project: {
        select: {
          name: true,
          archived: true,
        },
      },
    },
  });

  if (!sprint) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "sprint-not-found" }),
    );
  }

  if (sprint.project.archived) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }),
    );
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
    select: {
      id: true,
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

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN"]);

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      workspaceId,
      projectId,
    },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      project: {
        select: {
          name: true,
          archived: true,
        },
      },
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
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "sprint-not-found" }),
    );
  }

  if (sprint.project.archived) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }),
    );
  }

  if (sprint.status !== "ACTIVE") {
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

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN"]);

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      workspaceId,
      projectId,
    },
    select: {
      id: true,
      name: true,
      status: true,
      project: {
        select: {
          name: true,
          archived: true,
        },
      },
      issues: {
        where: {
          archived: false,
        },
        select: {
          id: true,
        },
      },
      sprintReport: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!sprint) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "sprint-not-found" }),
    );
  }

  if (sprint.project.archived) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }),
    );
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

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN"]);

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      workspaceId,
      projectId,
    },
    select: {
      id: true,
      name: true,
      status: true,
      project: {
        select: {
          name: true,
          archived: true,
        },
      },
    },
  });

  if (!sprint) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "sprint-not-found" }),
    );
  }

  if (sprint.status === "COMPLETED") {
    redirect(
      sprintsPageUrl(workspaceId, projectId, {
        error: "completed-sprint-locked",
      }),
    );
  }

  if (sprint.project.archived) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }),
    );
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
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "issue-not-found" }),
    );
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

  const { user } = await requireWorkspaceRole(workspaceId, ["OWNER", "ADMIN"]);

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      workspaceId,
      projectId,
    },
    select: {
      id: true,
      name: true,
      status: true,
      project: {
        select: {
          name: true,
          archived: true,
        },
      },
    },
  });

  if (!sprint) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "sprint-not-found" }),
    );
  }

  if (sprint.project.archived) {
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "project-archived" }),
    );
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
    redirect(
      sprintsPageUrl(workspaceId, projectId, { error: "issue-not-found" }),
    );
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

function IssuePills({ issue }: { issue: SprintIssueCardData }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      <span className={badgeClass}>{formatStatus(issue.status)}</span>
      <span className={badgeClass}>{getPriorityLabel(issue.priority)}</span>
      <span className={badgeClass}>{getTypeLabel(issue.type)}</span>
      <span className={badgeClass}>{issue.storyPoints ?? 0} pts</span>
      <span className={badgeClass}>{getAssigneeLabel(issue)}</span>
    </div>
  );
}

function SprintIssueCard({
  issue,
  workspaceId,
  projectId,
  sprintId,
  canRemove,
}: {
  issue: SprintIssueCardData;
  workspaceId: string;
  projectId: string;
  sprintId: string;
  canRemove: boolean;
}) {
  return (
    <article className={issueCardClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href={`/dashboard/${workspaceId}/projects/${projectId}/issues/${issue.id}`}
            className="text-sm font-extrabold text-white no-underline transition hover:text-[#f4e7b0]"
          >
            {issue.title}
          </Link>

          <p className="m-0 mt-1 line-clamp-1 max-w-3xl text-sm leading-5 text-white/45">
            {issue.description || "No description provided."}
          </p>

          <IssuePills issue={issue} />
        </div>

        {canRemove ? (
          <form action={removeIssueFromSprint} className="shrink-0">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="sprintId" value={sprintId} />
            <input type="hidden" name="issueId" value={issue.id} />

            <button
              type="submit"
              className={`${actionButtonClass} border-red-400/20 text-red-200 hover:bg-red-400/10`}
            >
              Remove
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function AddIssueCard({
  issue,
  workspaceId,
  projectId,
  sprintId,
}: {
  issue: SprintIssueCardData;
  workspaceId: string;
  projectId: string;
  sprintId: string;
}) {
  return (
    <form action={addIssueToSprint} className={issueCardClass}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sprintId" value={sprintId} />
      <input type="hidden" name="issueId" value={issue.id} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href={`/dashboard/${workspaceId}/projects/${projectId}/issues/${issue.id}`}
            className="text-sm font-extrabold text-white no-underline transition hover:text-[#f4e7b0]"
          >
            {issue.title}
          </Link>

          <p className="m-0 mt-1 line-clamp-1 max-w-3xl text-sm leading-5 text-white/45">
            {issue.description || "No description provided."}
          </p>

          <IssuePills issue={issue} />
        </div>

        <button type="submit" className={primaryButtonClass}>
          Add
        </button>
      </div>
    </form>
  );
}

function SprintStats({
  sprint,
}: {
  sprint: SprintCardData;
}) {
  const { completedIssues, totalPoints, velocity, completionRate } =
    getSprintMetrics(sprint.issues);

  const stats = [
    {
      label: "Start",
      value: formatDate(sprint.startDate),
    },
    {
      label: "End",
      value: formatDate(sprint.endDate),
    },
    {
      label: "Issues",
      value: sprint.issues.length,
    },
    {
      label: "Done",
      value: completedIssues.length,
    },
    {
      label: "Points",
      value: totalPoints,
    },
    {
      label: "Velocity",
      value: velocity,
    },
    {
      label: "Completion",
      value: `${completionRate}%`,
    },
  ];

  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {stats.map((stat) => (
        <span key={stat.label} className={badgeClass}>
          {stat.label}: {stat.value}
        </span>
      ))}
    </div>
  );
}

function SprintActions({
  sprint,
  workspaceId,
  projectId,
  canManageSprints,
  projectArchived,
}: {
  sprint: SprintCardData;
  workspaceId: string;
  projectId: string;
  canManageSprints: boolean;
  projectArchived: boolean;
}) {
  if (!canManageSprints || projectArchived || sprint.status === "COMPLETED") {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sprint.status === "PLANNED" ? (
        <form action={startSprint}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="sprintId" value={sprint.id} />

          <button
            type="submit"
            className={`${actionButtonClass} border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100`}
          >
            Start
          </button>
        </form>
      ) : null}

      {sprint.status === "ACTIVE" ? (
        <form action={completeSprint}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="sprintId" value={sprint.id} />

          <button type="submit" className={primaryButtonClass}>
            Complete
          </button>
        </form>
      ) : null}

      <form action={cancelSprint}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="sprintId" value={sprint.id} />

        <button
          type="submit"
          className={`${actionButtonClass} border-red-400/20 text-red-200 hover:bg-red-400/10`}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

function SprintWorkSection({
  sprint,
  workspaceId,
  projectId,
  unassignedIssues,
  canEditSprintIssues,
}: {
  sprint: SprintCardData;
  workspaceId: string;
  projectId: string;
  unassignedIssues: SprintIssueCardData[];
  canEditSprintIssues: boolean;
}) {
  return (
    <div className="mt-4 grid gap-3">
      <div className={sectionHeaderClass}>
        <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/35">
          Sprint issues
        </p>

        <h4 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
          Assigned work
        </h4>
      </div>

      {sprint.issues.length === 0 ? (
        <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/45">
          No issues assigned to this sprint yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {sprint.issues.map((issue) => (
            <SprintIssueCard
              key={issue.id}
              issue={issue}
              workspaceId={workspaceId}
              projectId={projectId}
              sprintId={sprint.id}
              canRemove={canEditSprintIssues}
            />
          ))}
        </div>
      )}

      {canEditSprintIssues && unassignedIssues.length > 0 ? (
        <div className="mt-1 grid gap-3">
          <div className={sectionHeaderClass}>
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/35">
              Add issues
            </p>

            <h4 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
              Unassigned work
            </h4>
          </div>

          <div className="grid gap-3">
            {unassignedIssues.map((issue) => (
              <AddIssueCard
                key={issue.id}
                issue={issue}
                workspaceId={workspaceId}
                projectId={projectId}
                sprintId={sprint.id}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SprintCard({
  sprint,
  workspaceId,
  projectId,
  projectArchived,
  canManageSprints,
  unassignedIssues,
  mode,
}: {
  sprint: SprintCardData;
  workspaceId: string;
  projectId: string;
  projectArchived: boolean;
  canManageSprints: boolean;
  unassignedIssues: SprintIssueCardData[];
  mode: "active" | "planned" | "completed";
}) {
  const canEditSprintIssues =
    canManageSprints && !projectArchived && sprint.status !== "COMPLETED";

  const report = sprint.sprintReport;

  return (
    <article className={sprintCardClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 truncate text-lg font-extrabold text-white">
              {sprint.name}
            </h3>

            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${getSprintStatusClass(
                sprint.status,
              )}`}
            >
              {formatStatus(sprint.status)}
            </span>
          </div>

          <p className="m-0 mt-1.5 line-clamp-2 max-w-3xl text-sm leading-5 text-white/45">
            {sprint.goal || "No goal provided."}
          </p>

          <SprintStats sprint={sprint} />
        </div>

        <SprintActions
          sprint={sprint}
          workspaceId={workspaceId}
          projectId={projectId}
          canManageSprints={canManageSprints}
          projectArchived={projectArchived}
        />
      </div>

      {mode === "completed" && report ? (
        <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/[0.035] p-4">
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/35">
            Sprint report
          </p>

          <h4 className="m-0 mt-1.5 text-lg font-extrabold text-white">
            Completion summary
          </h4>

          <p className="m-0 mt-2 max-w-4xl text-sm leading-6 text-white/50">
            {report.generatedSummary ||
              "Report generated for this completed sprint."}
          </p>
        </div>
      ) : null}

      <SprintWorkSection
        sprint={sprint}
        workspaceId={workspaceId}
        projectId={projectId}
        unassignedIssues={unassignedIssues}
        canEditSprintIssues={canEditSprintIssues}
      />
    </article>
  );
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
    select: {
      id: true,
      name: true,
      archived: true,
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
      select: {
        id: true,
        name: true,
        goal: true,
        status: true,
        startDate: true,
        endDate: true,
        completedAt: true,
        sprintReport: {
          select: {
            totalIssues: true,
            completedIssues: true,
            completionRate: true,
            velocity: true,
            generatedSummary: true,
          },
        },
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
            description: true,
            status: true,
            priority: true,
            type: true,
            storyPoints: true,
            assignee: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
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
        description: true,
        status: true,
        priority: true,
        type: true,
        storyPoints: true,
        assignee: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const plannedSprints = sprints.filter((sprint) => sprint.status === "PLANNED");
  const activeSprints = sprints.filter((sprint) => sprint.status === "ACTIVE");
  const completedSprints = sprints.filter(
    (sprint) => sprint.status === "COMPLETED",
  );

  const activeSprint = activeSprints[0] ?? null;

  const completedSprintVelocity = completedSprints.reduce((total, sprint) => {
    const metrics = getSprintMetrics(sprint.issues);

    return total + metrics.velocity;
  }, 0);

  const metrics = [
    {
      label: "Planned",
      value: plannedSprints.length,
      detail: "Ready cycles",
    },
    {
      label: "Active",
      value: activeSprints.length,
      detail: activeSprint ? activeSprint.name : "No active sprint",
    },
    {
      label: "Unassigned",
      value: unassignedIssues.length,
      detail: "Ready for planning",
    },
    {
      label: "Velocity",
      value: completedSprintVelocity,
      detail: "Done points",
    },
  ];

  const todayInputValue = getTodayInputValue();

  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <div className={shellClass}>
        <DashboardSidebar workspaceId={workspaceId} activePage="projects" />

        <section className={contentClass}>
          <header className={heroCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/dashboard/${workspaceId}/projects/${projectId}`}
                className="inline-flex h-8 w-fit shrink-0 items-center rounded-full border border-white/10 px-3 text-xs font-bold text-white/55 no-underline transition hover:-translate-y-px hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
              >
                ← Back
              </Link>

              <div className="flex min-w-0 flex-wrap justify-end gap-2">
                {project.archived ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-extrabold text-white/55">
                    Archived
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-extrabold text-emerald-200">
                    Active
                  </span>
                )}

                <span className="max-w-[220px] truncate rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-xs font-bold text-white/50">
                  {workspace.name}
                </span>
              </div>
            </div>

            <div className="mt-3 min-w-0">
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
                Sprint planning
              </p>

              <h1 className="m-0 mt-1 truncate text-[25px] font-extrabold tracking-[-0.04em] text-white md:text-[28px]">
                {project.name} sprints
              </h1>

              <p className="m-0 mt-1 max-w-3xl truncate text-sm text-white/45">
                Plan delivery cycles, assign project issues, and review reports.
              </p>
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

          {project.archived ? (
            <section className="rounded-[1.2rem] border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] px-4 py-3 text-sm font-bold leading-6 text-[#f4e7b0] shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
              This project is archived. Sprints stay visible for review, but
              sprint changes are locked.
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className={metricCardClass}>
                <p className="m-0 truncate text-xs font-bold text-white/45">
                  {metric.label}
                </p>

                <strong className="mt-1.5 block truncate text-xl font-extrabold tracking-[-0.04em] text-white">
                  {metric.value}
                </strong>

                <span className="mt-1 block truncate text-xs text-white/35">
                  {metric.detail}
                </span>
              </div>
            ))}
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}`}
              className={navCardClass}
            >
              <p className="m-0 break-words text-sm font-extrabold text-white">
                Project details
              </p>

              <p className="m-0 mt-1 line-clamp-2 break-words text-sm leading-5 text-white/45">
                Review project issues, descriptions, and active work.
              </p>
            </Link>

            <Link
              href={`/dashboard/${workspaceId}/projects/${projectId}/board`}
              className={navCardClass}
            >
              <p className="m-0 break-words text-sm font-extrabold text-white">
                Project board
              </p>

              <p className="m-0 mt-1 line-clamp-2 break-words text-sm leading-5 text-white/45">
                Move active issues through each project status.
              </p>
            </Link>
          </section>

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                Active sprint
              </p>

              <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                {activeSprint ? "Current delivery cycle" : "No active sprint"}
              </h2>
            </div>

            {activeSprint ? (
              <SprintCard
                sprint={activeSprint}
                workspaceId={workspaceId}
                projectId={projectId}
                projectArchived={project.archived}
                canManageSprints={canManageSprints}
                unassignedIssues={unassignedIssues}
                mode="active"
              />
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/45 shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
                Start a planned sprint below when the team is ready to begin a
                focused delivery cycle.
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
                Planned sprints
              </p>

              <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                {plannedSprints.length} planned
              </h2>
            </div>

            {plannedSprints.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/45 shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
                No planned sprints.
              </div>
            ) : (
              <div className="grid gap-3">
                {plannedSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    projectArchived={project.archived}
                    canManageSprints={canManageSprints}
                    unassignedIssues={unassignedIssues}
                    mode="planned"
                  />
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <div className={sectionHeaderClass}>
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/35">
                Completed sprints
              </p>

              <h2 className="m-0 mt-1.5 truncate text-lg font-extrabold text-white">
                {completedSprints.length} completed
              </h2>
            </div>

            {completedSprints.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/45 shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
                No completed sprints yet.
              </div>
            ) : (
              <div className="grid gap-3">
                {completedSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    projectArchived={project.archived}
                    canManageSprints={canManageSprints}
                    unassignedIssues={[]}
                    mode="completed"
                  />
                ))}
              </div>
            )}
          </section>

          {canManageSprints && !project.archived ? (
            <section className={cardClass}>
              <div className="mb-4">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/35">
                  New sprint
                </p>

                <h2 className="m-0 mt-1.5 text-lg font-extrabold text-white">
                  Create sprint
                </h2>

                <p className="m-0 mt-1.5 max-w-2xl text-sm leading-6 text-white/45">
                  Add another sprint when this project needs a new delivery
                  cycle.
                </p>
              </div>

              <form action={createSprint} className="grid gap-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="projectId" value={projectId} />

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-bold text-white/70"
                  >
                    Sprint name
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    maxLength={80}
                    placeholder="Example: Sprint 1"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="goal"
                    className="block text-sm font-bold text-white/70"
                  >
                    Goal
                  </label>

                  <textarea
                    id="goal"
                    name="goal"
                    rows={3}
                    maxLength={500}
                    placeholder="What should this sprint accomplish?"
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="startDate"
                      className="block text-sm font-bold text-white/70"
                    >
                      Start date
                    </label>

                    <input
                      id="startDate"
                      name="startDate"
                      type="date"
                      min={todayInputValue}
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="endDate"
                      className="block text-sm font-bold text-white/70"
                    >
                      End date
                    </label>

                    <input
                      id="endDate"
                      name="endDate"
                      type="date"
                      min={todayInputValue}
                      className={fieldClass}
                    />
                  </div>
                </div>

                <button type="submit" className={primaryButtonClass}>
                  Create sprint
                </button>
              </form>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
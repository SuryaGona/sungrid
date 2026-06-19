import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ProjectBoard } from "@/components/project-board";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/workspace-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoardPageProps = {
  params: Promise<{
    workspaceId: string;
    projectId: string;
  }>;
};

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export default async function ProjectBoardPage({ params }: BoardPageProps) {
  const { workspaceId, projectId } = await params;

  const { workspace, membership } = await requireWorkspaceAccess(workspaceId);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      archived: true,
      _count: {
        select: {
          issues: true,
          sprints: true,
        },
      },
    },
  });

  if (!project) {
    redirect(`/dashboard/${workspaceId}/projects?error=project-not-found`);
  }

  const issues = await prisma.issue.findMany({
    where: {
      workspaceId,
      projectId,
      archived: false,
    },
    include: {
      reporter: true,
      assignee: true,
      sprint: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: [
      {
        status: "asc",
      },
      {
        position: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });

  const boardIssues = issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    type: issue.type,
    storyPoints: issue.storyPoints,
    position: issue.position,
    reporterLabel: issue.reporter?.name || issue.reporter?.email || "Unknown",
    assigneeLabel:
      issue.assignee?.name || issue.assignee?.email || "Unassigned",
    sprintLabel: issue.sprint?.name || null,
  }));

  const doneCount = issues.filter((issue) => issue.status === "DONE").length;
  const openCount = Math.max(issues.length - doneCount, 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-gray-500">SunGrid</p>
            <h1 className="text-xl font-bold text-gray-900">
              {workspace.name}
            </h1>
          </div>

          <UserButton  />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <DashboardSidebar workspaceId={workspaceId} activePage="projects" />

        <section className="space-y-6 overflow-hidden">
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
                  Kanban board
                </p>

                <h2 className="mt-2 text-3xl font-bold text-gray-900">
                  {project.name}
                </h2>

                <p className="mt-2 max-w-3xl text-gray-600">
                  {project.description ||
                    "Move active issues through the delivery workflow. Archived issues are intentionally hidden from this board."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {project.archived ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                    Project archived
                  </span>
                ) : (
                  <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                    Active project
                  </span>
                )}

                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                  Role: {formatRole(membership.role)}
                </span>
              </div>
            </div>
          </div>

          {project.archived ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              This project is archived. Board movement should be locked, but the
              board remains visible for historical review.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Visible issues</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {issues.length}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Active non-archived work
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Open</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {openCount}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Not yet in Done
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Done</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {doneCount}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Completed on board
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Project totals</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {project._count.issues}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Includes archived issues
              </p>
            </div>
          </div>

          <ProjectBoard
            workspaceId={workspaceId}
            projectId={projectId}
            projectArchived={project.archived}
            initialIssues={boardIssues}
          />

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">
              Board behavior
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              This board shows only active issues. Moves use optimistic UI:
              cards move instantly, the server persists the status and position,
              and failed requests should roll back in the client board
              component.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
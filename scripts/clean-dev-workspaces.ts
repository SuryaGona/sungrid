import { prisma } from "../lib/db";

async function main() {
  const before = await prisma.$transaction([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.membership.count(),
    prisma.project.count(),
    prisma.issue.count(),
    prisma.sprint.count(),
    prisma.comment.count(),
    prisma.activityLog.count(),
  ]);

  console.log("Before cleanup:", {
    users: before[0],
    workspaces: before[1],
    memberships: before[2],
    projects: before[3],
    issues: before[4],
    sprints: before[5],
    comments: before[6],
    activityLogs: before[7],
  });

  await prisma.workspace.deleteMany();

  const after = await prisma.$transaction([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.membership.count(),
    prisma.project.count(),
    prisma.issue.count(),
    prisma.sprint.count(),
    prisma.comment.count(),
    prisma.activityLog.count(),
  ]);

  console.log("After cleanup:", {
    users: after[0],
    workspaces: after[1],
    memberships: after[2],
    projects: after[3],
    issues: after[4],
    sprints: after[5],
    comments: after[6],
    activityLogs: after[7],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
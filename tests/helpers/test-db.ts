import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const LOCAL_TEST_DATABASE_URL =
  "postgresql://sungrid:sungrid_test@localhost:5434/sungrid_test";

function getTestDatabaseUrl() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    (process.env.CI === "true" ? process.env.DATABASE_URL : undefined) ??
    LOCAL_TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("No test database URL is configured.");
  }

  const parsedUrl = new URL(databaseUrl);
  const databaseName = parsedUrl.pathname.replace(/^\//, "");

  const allowedHosts = new Set(["localhost", "127.0.0.1"]);
  const allowedDatabases = new Set(["sungrid_test", "sungrid_ci"]);

  if (!allowedHosts.has(parsedUrl.hostname)) {
    throw new Error(
      `Refusing to run integration tests against non-local database host: ${parsedUrl.hostname}`,
    );
  }

  if (!allowedDatabases.has(databaseName)) {
    throw new Error(
      `Refusing to run integration tests against database: ${databaseName}`,
    );
  }

  return databaseUrl;
}

const adapter = new PrismaPg({
  connectionString: getTestDatabaseUrl(),
});

export const testPrisma = new PrismaClient({
  adapter,
  log: [],
});

export async function resetTestDatabase() {
  await testPrisma.activityLog.deleteMany();
  await testPrisma.sprintReport.deleteMany();
  await testPrisma.comment.deleteMany();
  await testPrisma.invite.deleteMany();
  await testPrisma.issue.deleteMany();
  await testPrisma.sprint.deleteMany();
  await testPrisma.project.deleteMany();
  await testPrisma.membership.deleteMany();
  await testPrisma.workspace.deleteMany();
  await testPrisma.user.deleteMany();
}

export async function disconnectTestDatabase() {
  await testPrisma.$disconnect();
}
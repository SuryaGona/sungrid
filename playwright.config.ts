import { defineConfig, devices } from "@playwright/test";

const isCI = process.env.CI === "true";

const localTestDatabaseUrl =
  "postgresql://sungrid:sungrid_test@localhost:5434/sungrid_test";

const databaseUrl = isCI
  ? process.env.DATABASE_URL
  : localTestDatabaseUrl;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Playwright E2E tests.");
}

export default defineConfig({
  testDir: "./e2e",

  timeout: 30_000,

  expect: {
    timeout: 10_000,
  },

  fullyParallel: false,

  forbidOnly: isCI,

  retries: isCI ? 2 : 0,

  workers: isCI ? 1 : undefined,

  reporter: isCI
    ? [
        ["github"],
        ["html", { open: "never" }],
      ]
    : [
        ["list"],
        ["html", { open: "never" }],
      ],

  use: {
    baseURL: "http://localhost:3100",

    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  webServer: {
    command:
      "npm run dev -- --hostname localhost --port 3100",

    url: "http://localhost:3100",

    reuseExistingServer: !isCI,

    timeout: 120_000,

    env: {
      DATABASE_URL: databaseUrl,
    },
  },
});
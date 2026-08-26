import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },

  test: {
    environment: "node",

    clearMocks: true,
    mockReset: true,
    restoreMocks: true,

    testTimeout: 10_000,
    hookTimeout: 10_000,

    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage",

      include: ["lib/**/*.ts", "app/api/**/*.ts"],

      exclude: ["app/generated/**", "**/*.d.ts"],
    },
  },
});
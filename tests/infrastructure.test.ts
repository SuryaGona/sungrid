import { describe, expect, it } from "vitest";

describe("test infrastructure", () => {
  it("runs Vitest in the test environment", () => {
    expect(process.env.NODE_ENV).toBe("test");
  });

  it("uses the expected Node runtime", () => {
    expect(typeof process.version).toBe("string");
    expect(process.version.startsWith("v")).toBe(true);
  });
});
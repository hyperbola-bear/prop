import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { afterEach, describe, expect, it, vi } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../../..");
const workerCwd = path.join(repoRoot, "apps/worker");
const rootEnvPath = path.join(repoRoot, ".env");

describe("worker config environment loading", () => {
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.chdir(originalCwd);
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  it("loads DATABASE_URL from the repository-root .env when cwd is apps/worker", async () => {
    const rootEnv = parse(readFileSync(rootEnvPath));
    expect(rootEnv.DATABASE_URL).toBeTruthy();

    delete process.env.DATABASE_URL;
    process.chdir(workerCwd);

    await import("../config");

    expect(process.env.DATABASE_URL).toBe(rootEnv.DATABASE_URL);
  });
});

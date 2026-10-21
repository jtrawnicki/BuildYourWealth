import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Sprawdzenie trybu kończy skrypt, zanim uruchomi migracje lub build, więc
// test nie wykonuje prawdziwego budowania.
function vercelBuild(env: Record<string, string | undefined>) {
  const base = { ...process.env };
  delete base.APP_MODE;
  delete base.VERCEL_ENV;
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/vercel-build.ts"],
    { encoding: "utf8", env: { ...base, ...env }, timeout: 60_000 },
  );
  return { status: result.status, output: result.stdout + result.stderr };
}

describe("npm run vercel-build", () => {
  it("na Vercel bez APP_MODE=demo kończy się błędem przed budowaniem", () => {
    for (const env of [
      { VERCEL_ENV: "production" },
      { VERCEL_ENV: "preview", APP_MODE: "private" },
    ]) {
      const result = vercelBuild(env);
      expect(result.status).toBe(1);
      expect(result.output).toContain("APP_MODE=demo");
      expect(result.output).not.toContain("drizzle-kit");
    }
  });
});

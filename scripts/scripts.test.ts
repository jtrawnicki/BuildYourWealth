import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { verifyPassword } from "@/auth/password";
import { closePool, getPool } from "@/db/client";

const tmp = await mkdtemp(join(tmpdir(), "byw-scripts-"));

/** Uruchamia skrypt npm jak właściciel: `npm run <name> -- <args>`. */
function runScript(
  name: string,
  args: string[],
  options: { input?: string; env?: Record<string, string> } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      "npm",
      ["run", "--silent", name, "--", ...args],
      { env: { ...process.env, ...options.env } },
      (error, stdout, stderr) =>
        resolve({ code: error ? Number(error.code ?? 1) : 0, stdout, stderr }),
    );
    child.stdin?.end(options.input ?? "");
  });
}

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
  await closePool();
});

describe("npm run user:set-password", () => {
  const email = `cli-${randomUUID()}@example.com`;

  afterAll(async () => {
    await getPool().query("delete from users where email = $1", [email]);
  });

  it("uruchomiony dwa razy zmienia hasło zamiast tworzyć drugie konto", async () => {
    const first = await runScript("user:set-password", [email], {
      input: "pierwsze hasło\n",
    });
    expect(first).toMatchObject({ code: 0 });
    expect(first.stdout).toContain(`Utworzono konto ${email}.`);

    const second = await runScript("user:set-password", [email], {
      input: "drugie hasło!\n",
    });
    expect(second).toMatchObject({ code: 0 });
    expect(second.stdout).toContain(`Zmieniono hasło konta ${email}`);

    const { rows } = await getPool().query<{ password_hash: string }>(
      "select password_hash from users where email = $1",
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(await verifyPassword("drugie hasło!", rows[0].password_hash)).toBe(
      true,
    );
  });

  it("bez adresu e-mail kończy się błędem z instrukcją", async () => {
    const result = await runScript("user:set-password", []);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("Użycie: npm run user:set-password");
  });
});

describe("npm run db:dump", () => {
  it("zapisuje kopię schematu i danych do pliku", async () => {
    const file = join(tmp, "dump.sql");
    const result = await runScript("db:dump", [file]);
    expect(result.code, result.stderr).toBe(0);
    const dump = await readFile(file, "utf8");
    expect(dump).toContain("CREATE TABLE public.months");
    expect(dump).toContain("months_user_month_unique");
  });

  it("odmawia pracy z pg_dump starszym niż serwer", async () => {
    const fake = join(tmp, "old-pg-dump");
    await writeFile(fake, '#!/bin/sh\necho "pg_dump (PostgreSQL) 9.6.24"\n');
    await chmod(fake, 0o755);
    const file = join(tmp, "never.sql");
    const result = await runScript("db:dump", [file], {
      env: { PG_DUMP: fake },
    });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain(
      "pg_dump w wersji 9 jest starszy niż serwer",
    );
    await expect(readFile(file)).rejects.toThrow();
  });
});

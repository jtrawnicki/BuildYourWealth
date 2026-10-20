import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Client } from "pg";
import { loadEnv } from "./load-env";

// Użycie: npm run db:dump [-- <plik>]
// Kopia bazy z `DATABASE_URL` w formacie pg_dump „custom” (odtwarzanie:
// pg_restore). `pg_dump` musi mieć wersję co najmniej równą serwerowi
// (STACK 6); `PG_DUMP` wskazuje inny program pg_dump, np. nowszą wersję.

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function serverMajor(url: string): Promise<number> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ server_version_num: string }>(
      "show server_version_num",
    );
    return Math.floor(Number(rows[0].server_version_num) / 10000);
  } finally {
    await client.end();
  }
}

function clientMajor(pgDump: string): number {
  let output: string;
  try {
    output = execFileSync(pgDump, ["--version"], { encoding: "utf8" });
  } catch (error) {
    fail(`Nie udało się uruchomić pg_dump: ${(error as Error).message}`);
  }
  const major = /\(PostgreSQL\)\s+(\d+)/.exec(output)?.[1];
  if (!major) {
    fail(`Nie rozpoznano wersji pg_dump: ${output.trim()}`);
  }
  return Number(major);
}

async function main(): Promise<void> {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    fail("Brak zmiennej środowiskowej DATABASE_URL.");
  }
  const pgDump = process.env.PG_DUMP || "pg_dump";

  const server = await serverMajor(url).catch((error: Error) =>
    fail(`Nie udało się połączyć z bazą: ${error.message}`),
  );
  const dumpVersion = clientMajor(pgDump);
  if (!(dumpVersion >= server)) {
    fail(
      `pg_dump w wersji ${dumpVersion} jest starszy niż serwer (${server}). ` +
        `Zainstaluj klienta Postgres ${server} albo wskaż go zmienną PG_DUMP.`,
    );
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const file = process.argv[2] ?? `backups/byw-${stamp}.dump`;
  mkdirSync(dirname(file), { recursive: true });

  // Hasło idzie do pg_dump przez PGPASSWORD, żeby nie było widoczne w liście procesów.
  const target = new URL(url);
  const password = decodeURIComponent(target.password);
  target.password = "";

  const result = spawnSync(
    pgDump,
    [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      `--file=${file}`,
      target.toString(),
    ],
    {
      stdio: "inherit",
      env: password ? { ...process.env, PGPASSWORD: password } : process.env,
    },
  );
  if (result.error) {
    fail(`Nie udało się uruchomić pg_dump: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  chmodSync(file, 0o600);
  console.log(`Zapisano kopię bazy: ${file}`);
}

main().catch((error: unknown) =>
  fail(error instanceof Error ? error.message : String(error)),
);

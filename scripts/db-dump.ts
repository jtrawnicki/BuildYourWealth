// Użycie: npm run db:dump [-- <plik>]
// Kopia bazy z `DATABASE_URL` w formacie SQL (domyślnie do `backups/`).
// `pg_dump` musi mieć wersję co najmniej równą serwerowi (STACK 6);
// inny plik wykonywalny można wskazać zmienną `PG_DUMP`.
import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { loadEnvConfig } from "@next/env";
import { closePool, getPool } from "@/db/client";

loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

const run = promisify(execFile);
const pgDump = process.env.PG_DUMP || "pg_dump";

function defaultFile(now: Date): string {
  const stamp = now
    .toISOString()
    .replace(/\.\d+Z$/, "")
    .replace(/[-:]/g, "")
    .replace("T", "-");
  return join("backups", `byw-${stamp}.sql`);
}

async function main(): Promise<void> {
  if (process.argv.length > 3) {
    throw new Error("Użycie: npm run db:dump [-- <plik>]");
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Brak zmiennej środowiskowej DATABASE_URL.");
  }

  const { rows } = await getPool().query<{ server_version_num: string }>(
    "show server_version_num",
  );
  const serverMajor = Math.floor(Number(rows[0].server_version_num) / 10000);
  const { stdout } = await run(pgDump, ["--version"]);
  const clientMajor = Number(/(\d+)(?:\.\d+)?/.exec(stdout)?.[1]);
  if (!(clientMajor >= serverMajor)) {
    throw new Error(
      `pg_dump w wersji ${clientMajor} jest starszy niż serwer (${serverMajor}). ` +
        `Zainstaluj klienta Postgres ${serverMajor} albo wskaż go zmienną PG_DUMP.`,
    );
  }

  const file = process.argv[2] ?? defaultFile(new Date());
  await mkdir(dirname(file), { recursive: true });
  await run(pgDump, [
    "--no-owner",
    "--no-privileges",
    `--file=${file}`,
    `--dbname=${url}`,
  ]);
  console.log(`Zapisano kopię bazy: ${file}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);

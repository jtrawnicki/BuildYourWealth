import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadEnv } from "./load-env";

// Użycie: npm run db:dump [-- <plik>]
// Kopia bazy z `DATABASE_URL` w formacie pg_dump „custom” (odtwarzanie:
// pg_restore). `PG_DUMP` wskazuje inny program pg_dump, np. nowszą wersję.
loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Brak zmiennej środowiskowej DATABASE_URL.");
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
const file = process.argv[2] ?? `backups/byw-${stamp}.dump`;
mkdirSync(dirname(file), { recursive: true });

// Hasło idzie do pg_dump przez PGPASSWORD, żeby nie było widoczne w liście procesów.
const target = new URL(url);
const password = decodeURIComponent(target.password);
target.password = "";

const result = spawnSync(
  process.env.PG_DUMP ?? "pg_dump",
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
  console.error(`Nie udało się uruchomić pg_dump: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
chmodSync(file, 0o600);
console.log(`Zapisano kopię bazy: ${file}`);

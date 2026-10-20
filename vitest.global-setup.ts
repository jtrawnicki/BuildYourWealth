import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { loadTestEnv } from "./test-env";

/**
 * Przed testami odtwarza schemat testowej bazy od zera poleceniem
 * `npm run db:migrate`. Czyści tylko bazę, której nazwa kończy się na `_test`,
 * żeby `DATABASE_URL` z powłoki nie wskazał przypadkiem innej bazy.
 */
export default async function setup(): Promise<void> {
  loadTestEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Brak zmiennej środowiskowej DATABASE_URL.");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ name: string }>(
      "select current_database() as name",
    );
    if (!rows[0].name.endsWith("_test")) {
      throw new Error(
        `Testy czyszczą bazę, więc jej nazwa musi kończyć się na _test (jest: ${rows[0].name}).`,
      );
    }
    await client.query(
      "drop schema if exists drizzle cascade; drop schema public cascade; create schema public;",
    );
  } finally {
    await client.end();
  }

  execFileSync("npm", ["run", "--silent", "db:migrate"], {
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: "inherit",
  });
}

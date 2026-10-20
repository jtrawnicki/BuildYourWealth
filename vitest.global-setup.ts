import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { loadTestEnv } from "./test-env";

/**
 * Przed testami doprowadza bazę testową do schematu z `drizzle/`. Testy
 * zapisują i usuwają dane, więc odmawia pracy na bazie, której nazwa nie
 * kończy się na `_test` (np. gdy `DATABASE_URL` z powłoki wskazuje inną bazę).
 */
export default async function setup(): Promise<void> {
  loadTestEnv();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query<{ name: string }>(
      "select current_database() as name",
    );
    if (!rows[0].name.endsWith("_test")) {
      throw new Error(
        `Testy zapisują i usuwają dane, więc nazwa bazy musi kończyć się na _test (jest: ${rows[0].name}).`,
      );
    }
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}

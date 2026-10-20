import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { loadTestEnv } from "./test-env";

/** Przed testami doprowadza bazę testową do schematu z `drizzle/`. */
export default async function setup(): Promise<void> {
  loadTestEnv();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}

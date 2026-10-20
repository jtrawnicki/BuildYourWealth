import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

/** Pula połączeń do bazy wskazanej przez `DATABASE_URL`, tworzona przy pierwszym użyciu. */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Brak zmiennej środowiskowej DATABASE_URL.");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

/** Klient Drizzle na wspólnej puli połączeń. */
export function getDb(): NodePgDatabase<typeof schema> {
  db ??= drizzle(getPool(), { schema });
  return db;
}

export type Db = NodePgDatabase<typeof schema>;

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

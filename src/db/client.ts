import { Pool } from "pg";

let pool: Pool | undefined;

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

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

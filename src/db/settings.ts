import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { settings } from "./schema";

/** Kurs EUR→PLN użytkownika w dziesięciotysięcznych albo `null`, gdy nieustawiony. */
export async function getEurRate(
  db: Db,
  userId: number,
): Promise<number | null> {
  const [row] = await db
    .select({ eurRate: settings.eurRate })
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);
  return row?.eurRate ?? null;
}

/**
 * Zapisuje kurs. Zmienia tylko ustawienie: wartości EUR źródeł i kursy zapisane
 * przy rozliczeniu zostają bez zmian (SPEC 7).
 */
export async function setEurRate(
  db: Db,
  userId: number,
  eurRate: number,
): Promise<void> {
  await db
    .insert(settings)
    .values({ userId, eurRate })
    .onConflictDoUpdate({ target: settings.userId, set: { eurRate } });
}

import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { settings } from "./schema";

/**
 * Kurs zapasowy EUR→PLN w dziesięciotysięcznych albo `null` (SPEC 5.9, reguła
 * 6.10). Używany, gdy aplikacja nie ma pasującego kursu z NBP; bieżący kurs na
 * ekranach bierze się z NBP (`rates/current-rate.ts`), nie z ustawienia.
 */
export async function getFallbackEurRate(
  db: Db,
  userId: number,
): Promise<number | null> {
  const [row] = await db
    .select({ fallbackEurRate: settings.fallbackEurRate })
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);
  return row?.fallbackEurRate ?? null;
}

/**
 * Zapisuje kurs zapasowy. Zmienia tylko ustawienie: wartości EUR źródeł i kursy
 * zapisane przy rozliczeniu zostają bez zmian (SPEC 7).
 */
export async function setFallbackEurRate(
  db: Db,
  userId: number,
  fallbackEurRate: number,
): Promise<void> {
  await db
    .insert(settings)
    .values({ userId, fallbackEurRate })
    .onConflictDoUpdate({
      target: settings.userId,
      set: { fallbackEurRate },
    });
}

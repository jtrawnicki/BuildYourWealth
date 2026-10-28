import { and, asc, eq, gte, lte, max, min, sql } from "drizzle-orm";
import type { FetchedRate, RateCurrency } from "@/rates/nbp";
import type { NbpRate } from "@/rates/select";
import type { Db } from "./client";
import { exchangeRates, rateFetches } from "./schema";

// Kursy NBP i ostatnia próba pobrania (STACK 5 „Kurs NBP”). Kursy są wspólne
// dla wszystkich kont, więc zapytania nie mają `user_id`.

/** Najstarsza i najnowsza zapisana data tabeli albo `null`, gdy kursów brak. */
export async function storedRateBounds(
  db: Db,
  currency: RateCurrency,
): Promise<{ first: string; last: string } | null> {
  const [row] = await db
    .select({
      first: min(exchangeRates.effectiveDate),
      last: max(exchangeRates.effectiveDate),
    })
    .from(exchangeRates)
    .where(eq(exchangeRates.currency, currency));
  return row?.first && row.last ? { first: row.first, last: row.last } : null;
}

/** Zapisuje tabele; już zapisane (ta sama waluta i data) zostają bez zmian. */
export async function saveRates(
  db: Db,
  currency: RateCurrency,
  rates: readonly FetchedRate[],
): Promise<void> {
  if (rates.length === 0) return;
  await db
    .insert(exchangeRates)
    .values(rates.map((r) => ({ currency, ...r })))
    .onConflictDoNothing();
}

/**
 * Rezerwuje próbę pobrania, jeśli od poprzedniej minęła co najmniej godzina
 * (SPEC Z11). Warunkowy upsert rozstrzyga równoległe żądania: próbę dostaje
 * tylko jedno. Zarezerwowana próba ma `ok = false` do czasu `markFetchOk`.
 */
export async function claimRateFetch(
  db: Db,
  currency: RateCurrency,
  now: Date,
): Promise<boolean> {
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const claimed = await db
    .insert(rateFetches)
    .values({ currency, attemptedAt: now, ok: false })
    .onConflictDoUpdate({
      target: rateFetches.currency,
      set: { attemptedAt: now, ok: false },
      setWhere: lte(rateFetches.attemptedAt, hourAgo),
    })
    .returning({ currency: rateFetches.currency });
  return claimed.length > 0;
}

export async function markRateFetchOk(
  db: Db,
  currency: RateCurrency,
): Promise<void> {
  await db
    .update(rateFetches)
    .set({ ok: true })
    .where(eq(rateFetches.currency, currency));
}

/**
 * Zapisane kursy z zakresu `from`…`to` razem z ostatnim przed `from`, żeby
 * `kurs na dzień` i `bieżący kurs` (reguła 6.10) działały także po przerwie
 * w pobieraniu. Rosnąco po dacie.
 */
export async function storedRates(
  db: Db,
  currency: RateCurrency,
  from: string,
  to: string,
): Promise<NbpRate[]> {
  const before = db
    .select({ day: max(exchangeRates.effectiveDate) })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.currency, currency),
        lte(exchangeRates.effectiveDate, from),
      ),
    );
  return db
    .select({
      effectiveDate: exchangeRates.effectiveDate,
      rate: exchangeRates.rate,
    })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.currency, currency),
        gte(exchangeRates.effectiveDate, sql`coalesce((${before}), ${from})`),
        lte(exchangeRates.effectiveDate, to),
      ),
    )
    .orderBy(asc(exchangeRates.effectiveDate));
}

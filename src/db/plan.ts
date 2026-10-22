import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "./client";
import { goals, months, monthGoals, settings, sources } from "./schema";

export type Pool = "savings" | "investments";
export type Currency = "PLN" | "EUR";

/** Źródło do wyboru na liście celu: typ wyznacza pulę, waluta — regułę 6.9. */
export type PlanSource = {
  id: number;
  name: string;
  kind: Pool;
  currency: Currency;
};

/**
 * Cel bieżącego planu. `currency` to waluta jego źródła, a `hasSettled` mówi,
 * czy cel ma rozliczone wpłaty — razem z kwotą docelową lub startową blokują
 * zmianę źródła na inną walutę (SPEC 6.9).
 */
export type PlanGoalRow = {
  id: number;
  pool: Pool;
  name: string;
  pct: number;
  sourceId: number;
  currency: Currency;
  targetAmount: number | null;
  startAmount: number | null;
  hasSettled: boolean;
};

export type PlanData = {
  savingsPct: number;
  investmentsPct: number;
  goals: PlanGoalRow[];
};

/** Procenty pul użytkownika (domyślnie 0) i cele bieżącego planu w kolejności dodania. */
export async function getPlan(db: Db, userId: number): Promise<PlanData> {
  const [setting] = await db
    .select({
      savingsPct: settings.savingsPct,
      investmentsPct: settings.investmentsPct,
    })
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);

  const rows = await db
    .select({
      id: goals.id,
      pool: goals.pool,
      name: goals.name,
      pct: goals.pct,
      sourceId: goals.sourceId,
      currency: sources.currency,
      targetAmount: goals.targetAmount,
      startAmount: goals.startAmount,
      hasSettled: sql<boolean>`exists (
        select 1 from ${monthGoals}
        join ${months} on ${months.id} = ${monthGoals.monthId}
        where ${monthGoals.goalId} = ${goals.id}
          and ${months.settledAt} is not null
      )`,
    })
    .from(goals)
    .innerJoin(sources, eq(sources.id, goals.sourceId))
    .where(and(eq(goals.userId, userId), isNull(goals.removedAt)))
    .orderBy(asc(goals.position), asc(goals.id));

  return {
    savingsPct: setting?.savingsPct ?? 0,
    investmentsPct: setting?.investmentsPct ?? 0,
    goals: rows,
  };
}

/** Niezarchiwizowane źródła użytkownika do wyboru w celach, w kolejności dodania. */
export async function listPlanSources(
  db: Db,
  userId: number,
): Promise<PlanSource[]> {
  return db
    .select({
      id: sources.id,
      name: sources.name,
      kind: sources.kind,
      currency: sources.currency,
    })
    .from(sources)
    .where(and(eq(sources.userId, userId), isNull(sources.archivedAt)))
    .orderBy(asc(sources.id));
}

/** Cel w zapisie planu: `id` obecne dla istniejącego celu, puste dla nowego. */
export type PlanGoalInput = {
  id: number | null;
  pool: Pool;
  name: string;
  pct: number;
  sourceId: number;
  targetAmount: number | null;
  startAmount: number | null;
};

export type PlanInput = {
  savingsPct: number;
  investmentsPct: number;
  goals: PlanGoalInput[];
};

export type SavePlanResult =
  | { status: "ok" }
  | { status: "source-missing"; goalName: string }
  | { status: "currency-locked"; goalName: string }
  | { status: "stale" };

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Zapisuje cały plan atomowo: procenty pul i cele razem albo nic (SPEC 5.3).
 * Reguły pieniężne (suma pul, suma celów) sprawdza `domain` przed zapisem;
 * tutaj pilnujemy spójności z danymi: źródło musi istnieć, być aktywne i mieć
 * typ swojej puli, a zmiana waluty źródła celu z kwotą docelową, startową albo
 * rozliczonymi wpłatami jest zablokowana (SPEC 6.9).
 *
 * Klucz obcy celu do źródła jest odroczony (migracja 0001), więc najpierw
 * blokujemy źródła `for share` z warunkiem `archived_at is null`; pod tą
 * blokadą archiwizacja źródła czeka, a my widzimy aktualny stan (STACK, note
 * w `db/sources.ts`).
 */
export async function savePlan(
  db: Db,
  userId: number,
  input: PlanInput,
): Promise<SavePlanResult> {
  return db.transaction(async (tx) => {
    const sourceIds = [...new Set(input.goals.map((goal) => goal.sourceId))];
    const active = await lockSources(tx, userId, sourceIds);

    for (const goal of input.goals) {
      const source = active.get(goal.sourceId);
      if (!source || source.kind !== goal.pool) {
        return { status: "source-missing", goalName: goal.name };
      }
    }

    const existing = await loadExistingGoals(tx, userId);
    const keptIds = new Set<number>();
    for (const goal of input.goals) {
      if (goal.id === null) continue;
      const current = existing.get(goal.id);
      if (!current) return { status: "stale" };
      keptIds.add(goal.id);
      const newCurrency = active.get(goal.sourceId)!.currency;
      const currencyLocked =
        goal.targetAmount !== null ||
        goal.startAmount !== null ||
        current.hasSettled;
      if (newCurrency !== current.currency && currencyLocked) {
        return { status: "currency-locked", goalName: goal.name };
      }
    }

    await tx
      .insert(settings)
      .values({
        userId,
        savingsPct: input.savingsPct,
        investmentsPct: input.investmentsPct,
      })
      .onConflictDoUpdate({
        target: settings.userId,
        set: {
          savingsPct: input.savingsPct,
          investmentsPct: input.investmentsPct,
        },
      });

    const removedIds = [...existing.keys()].filter((id) => !keptIds.has(id));
    if (removedIds.length > 0) {
      await tx
        .update(goals)
        .set({ removedAt: sql`now()` })
        .where(and(eq(goals.userId, userId), inArray(goals.id, removedIds)));
    }

    // Pozycja = kolejność w wysłanej liście, więc cele pokazują się w kolejności
    // dodania (nowe trafiają na koniec), a zmiany kolejności nie ma (SPEC 5.3).
    for (const [position, goal] of input.goals.entries()) {
      const values = {
        pool: goal.pool,
        name: goal.name,
        pct: goal.pct,
        sourceId: goal.sourceId,
        targetAmount: goal.targetAmount,
        startAmount: goal.startAmount,
        position,
      };
      if (goal.id === null) {
        await tx.insert(goals).values({ userId, ...values });
      } else {
        await tx
          .update(goals)
          .set(values)
          .where(and(eq(goals.id, goal.id), eq(goals.userId, userId)));
      }
    }

    return { status: "ok" };
  });
}

/** Blokuje aktywne źródła współdzielnie w ustalonej kolejności (bez zakleszczeń). */
async function lockSources(
  tx: Tx,
  userId: number,
  ids: number[],
): Promise<Map<number, { kind: Pool; currency: Currency }>> {
  const map = new Map<number, { kind: Pool; currency: Currency }>();
  if (ids.length === 0) return map;
  const rows = await tx
    .select({
      id: sources.id,
      kind: sources.kind,
      currency: sources.currency,
    })
    .from(sources)
    .where(
      and(
        eq(sources.userId, userId),
        isNull(sources.archivedAt),
        inArray(sources.id, ids),
      ),
    )
    .orderBy(asc(sources.id))
    .for("share");
  for (const row of rows) map.set(row.id, row);
  return map;
}

async function loadExistingGoals(
  tx: Tx,
  userId: number,
): Promise<Map<number, { currency: Currency; hasSettled: boolean }>> {
  const rows = await tx
    .select({
      id: goals.id,
      currency: sources.currency,
      hasSettled: sql<boolean>`exists (
        select 1 from ${monthGoals}
        join ${months} on ${months.id} = ${monthGoals.monthId}
        where ${monthGoals.goalId} = ${goals.id}
          and ${months.settledAt} is not null
      )`,
    })
    .from(goals)
    .innerJoin(sources, eq(sources.id, goals.sourceId))
    .where(and(eq(goals.userId, userId), isNull(goals.removedAt)));
  const map = new Map<number, { currency: Currency; hasSettled: boolean }>();
  for (const row of rows) {
    map.set(row.id, { currency: row.currency, hasSettled: row.hasSettled });
  }
  return map;
}

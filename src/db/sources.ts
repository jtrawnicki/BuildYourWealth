import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db, Tx } from "./client";
import { goals, months, monthGoals, sources } from "./schema";

export type SourceKind = "savings" | "investments";
export type SourceCurrency = "PLN" | "EUR";

export type SourceInput = {
  name: string;
  kind: SourceKind;
  currency: SourceCurrency;
  value: number;
  note: string | null;
};

/**
 * Źródło na liście Majątku z regułami SPEC 5.2 policzonymi w bazie:
 * - `inUse`: używa go cel bieżącego planu albo planu nierozliczonego miesiąca
 *   (blokuje archiwizację);
 * - `kindLocked`: jest połączone z celem bieżącego planu albo z celem
 *   w migawce dowolnego miesiąca, czyli także z rozliczonymi wpłatami
 *   (blokuje zmianę typu i waluty).
 */
export type SourceRow = SourceInput & {
  id: number;
  inUse: boolean;
  kindLocked: boolean;
};

const inCurrentPlan = sql<boolean>`exists (
  select 1 from ${goals}
  where ${goals.sourceId} = ${sources.id} and ${goals.removedAt} is null
)`;

const inOpenMonth = sql<boolean>`exists (
  select 1 from ${monthGoals}
  join ${months} on ${months.id} = ${monthGoals.monthId}
  where ${monthGoals.sourceId} = ${sources.id}
    and ${months.userId} = ${sources.userId}
    and ${months.settledAt} is null
)`;

const inAnyMonth = sql<boolean>`exists (
  select 1 from ${monthGoals}
  join ${months} on ${months.id} = ${monthGoals.monthId}
  where ${monthGoals.sourceId} = ${sources.id}
    and ${months.userId} = ${sources.userId}
)`;

const active = (userId: number) =>
  and(eq(sources.userId, userId), isNull(sources.archivedAt));

/**
 * Blokuje wiersz źródła do końca transakcji. Powiązania sprawdzamy dopiero
 * kolejnym zapytaniem: w READ COMMITTED dostaje ono nową migawkę, więc widzi
 * też cel zapisany przez transakcję, na którą blokada czekała.
 */
async function lockActive(tx: Tx, userId: number, id: number) {
  const [row] = await tx
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.id, id), active(userId)))
    .for("update");
  return row !== undefined;
}

/** Niezarchiwizowane źródła użytkownika w kolejności dodania. */
export async function listSources(
  db: Db,
  userId: number,
): Promise<SourceRow[]> {
  return db
    .select({
      id: sources.id,
      name: sources.name,
      kind: sources.kind,
      currency: sources.currency,
      value: sources.value,
      note: sources.note,
      inUse: sql<boolean>`(${inCurrentPlan} or ${inOpenMonth})`,
      kindLocked: sql<boolean>`(${inCurrentPlan} or ${inAnyMonth})`,
    })
    .from(sources)
    .where(active(userId))
    .orderBy(asc(sources.id));
}

export async function createSource(
  db: Db,
  userId: number,
  input: SourceInput,
): Promise<number> {
  const [row] = await db
    .insert(sources)
    .values({ userId, ...input })
    .returning({ id: sources.id });
  return row.id;
}

export type UpdateResult = "ok" | "not-found" | "kind-locked";

/**
 * Zapisuje edycję źródła. Zmiana typu lub waluty połączonego źródła jest
 * odrzucana; nazwę, notatkę i wartość można zmieniać zawsze (SPEC 5.2).
 * Sprawdzenie i zapis działają pod blokadą wiersza.
 */
export async function updateSource(
  db: Db,
  userId: number,
  id: number,
  input: SourceInput,
): Promise<UpdateResult> {
  return db.transaction(async (tx) => {
    if (!(await lockActive(tx, userId, id))) return "not-found";
    const [current] = await tx
      .select({
        kind: sources.kind,
        currency: sources.currency,
        kindLocked: sql<boolean>`(${inCurrentPlan} or ${inAnyMonth})`,
      })
      .from(sources)
      .where(eq(sources.id, id));
    const kindChanged =
      current.kind !== input.kind || current.currency !== input.currency;
    if (kindChanged && current.kindLocked) return "kind-locked";
    await tx
      .update(sources)
      .set(input)
      .where(and(eq(sources.id, id), eq(sources.userId, userId)));
    return "ok";
  });
}

export type ArchiveResult = "ok" | "not-found" | "has-value" | "in-use";

/**
 * Archiwizuje źródło o wartości 0, którego nie używa cel bieżącego planu ani
 * planu nierozliczonego miesiąca (SPEC 5.2).
 *
 * Klucze obce celu i migawki do źródła są odroczone (migracja 0001), więc
 * sam zapis celu albo migawki miesiąca nie blokuje źródła. Zapis celu (plan
 * podziału) i tworzenie migawki miesiąca muszą więc najpierw zablokować
 * swoje źródła (`for share` z warunkiem `archived_at is null`) i pod tą
 * blokadą sprawdzić, że źródło istnieje i ma typ puli celu; wtedy
 * archiwizacja, zmiana typu i zapis celu wykonują się po kolei.
 */
export async function archiveSource(
  db: Db,
  userId: number,
  id: number,
): Promise<ArchiveResult> {
  return db.transaction(async (tx) => {
    if (!(await lockActive(tx, userId, id))) return "not-found";
    const [current] = await tx
      .select({
        value: sources.value,
        inUse: sql<boolean>`(${inCurrentPlan} or ${inOpenMonth})`,
      })
      .from(sources)
      .where(eq(sources.id, id));
    if (current.value > 0) return "has-value";
    if (current.inUse) return "in-use";
    await tx
      .update(sources)
      .set({ archivedAt: sql`now()` })
      .where(and(eq(sources.id, id), eq(sources.userId, userId)));
    return "ok";
  });
}

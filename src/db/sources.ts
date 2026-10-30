import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db, Tx } from "./client";
import { goals, months, monthGoals, sources, sourceValues } from "./schema";

export type SourceKind = "savings" | "investments";
export type SourceCurrency = "PLN" | "EUR";

export type SourceInput = {
  name: string;
  kind: SourceKind;
  currency: SourceCurrency;
  value: number;
  note: string | null;
  /** Źródło nie wchodzi do sum majątku (SPEC 5.2, P35); domyślnie `false`. */
  excludedFromNetWorth?: boolean;
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
  excludedFromNetWorth: boolean;
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

export type ValueReason = "created" | "manual" | "settlement" | "archived";

export type ValueChange =
  /** Nowa wartość źródła. */
  | { value: number }
  /** Wpłata dopisywana do bieżącej wartości (rozliczenie). */
  | { delta: number };

/**
 * Jedyny zapis `sources.value` (STACK 5 „Historia wartości"): zmienia wartość
 * źródła i w tej samej transakcji dopisuje do historii wiersz z wartością po
 * zmianie, bieżącą walutą źródła i powodem. `recordedAt` podaje tylko generator
 * demo; aplikacja zapisuje chwilę transakcji (`now()`), tę samą co
 * `settled_at` rozliczenia. Zmiana i wpis historii idą jednym zapytaniem (CTE):
 * piaskownica demo wywołuje tę funkcję kilkadziesiąt razy przy tworzeniu.
 * Zwraca `false`, gdy źródła nie ma.
 */
export async function changeSourceValue(
  tx: Tx,
  userId: number,
  sourceId: number,
  change: ValueChange,
  reason: ValueReason,
  recordedAt?: Date,
): Promise<boolean> {
  const value =
    "delta" in change
      ? sql`${sources.value} + ${change.delta}`
      : sql`${change.value}`;
  const at = recordedAt ? sql`${recordedAt.toISOString()}` : sql`now()`;
  const result = await tx.execute(sql`
    with changed as (
      update ${sources} set "value" = ${value}
      where ${sources.id} = ${sourceId} and ${sources.userId} = ${userId}
      returning "id", "user_id", "value", "currency"
    )
    insert into ${sourceValues}
      ("user_id", "source_id", "value", "currency", "recorded_at", "reason")
    select "user_id", "id", "value", "currency", ${at}, ${reason}
    from changed`);
  return (result.rowCount ?? 0) > 0;
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
      excludedFromNetWorth: sources.excludedFromNetWorth,
      inUse: sql<boolean>`(${inCurrentPlan} or ${inOpenMonth})`,
      kindLocked: sql<boolean>`(${inCurrentPlan} or ${inAnyMonth})`,
    })
    .from(sources)
    .where(active(userId))
    .orderBy(asc(sources.id));
}

/** Zapis historii wartości na wykres majątku (reguła 6.11). */
export type SourceValueEntry = {
  sourceId: number;
  value: number;
  currency: SourceCurrency;
  recordedAt: Date;
  /** Bieżące ustawienie źródła: wykluczenie działa wstecz (P35). */
  excludedFromNetWorth: boolean;
};

/**
 * Cała historia wartości źródeł użytkownika, także zarchiwizowanych, rosnąco po
 * chwili zapisu (SPEC 5.11). Wykres odtwarza z niej stan na koniec każdego
 * miesiąca, więc potrzebuje wszystkich źródeł, nie tylko aktywnych.
 */
export async function listSourceHistory(
  db: Db,
  userId: number,
): Promise<SourceValueEntry[]> {
  return db
    .select({
      sourceId: sourceValues.sourceId,
      value: sourceValues.value,
      currency: sourceValues.currency,
      recordedAt: sourceValues.recordedAt,
      excludedFromNetWorth: sources.excludedFromNetWorth,
    })
    .from(sourceValues)
    .innerJoin(sources, eq(sources.id, sourceValues.sourceId))
    .where(eq(sourceValues.userId, userId))
    .orderBy(asc(sourceValues.recordedAt), asc(sourceValues.id));
}

export async function createSource(
  db: Db,
  userId: number,
  input: SourceInput,
): Promise<number> {
  const { value, ...rest } = input;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sources)
      .values({ userId, ...rest })
      .returning({ id: sources.id });
    await changeSourceValue(tx, userId, row.id, { value }, "created");
    return row.id;
  });
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
        value: sources.value,
        kindLocked: sql<boolean>`(${inCurrentPlan} or ${inAnyMonth})`,
      })
      .from(sources)
      .where(eq(sources.id, id));
    const kindChanged =
      current.kind !== input.kind || current.currency !== input.currency;
    if (kindChanged && current.kindLocked) return "kind-locked";
    const { value, ...rest } = input;
    await tx
      .update(sources)
      .set(rest)
      .where(and(eq(sources.id, id), eq(sources.userId, userId)));
    // Zmiana waluty bez zmiany liczby też zmienia wartość: historia zapisuje ją
    // w nowej walucie (SPEC 7).
    if (value !== current.value || current.currency !== input.currency) {
      await changeSourceValue(tx, userId, id, { value }, "manual");
    }
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
    // Od archiwizacji źródło ma w historii wartość 0 (SPEC 7).
    await changeSourceValue(tx, userId, id, { value: 0 }, "archived");
    await tx
      .update(sources)
      .set({ archivedAt: sql`now()` })
      .where(and(eq(sources.id, id), eq(sources.userId, userId)));
    return "ok";
  });
}

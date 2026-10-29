import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closePool, getDb, getPool } from "./client";
import {
  goals,
  monthGoals,
  months,
  sources,
  sourceValues,
  users,
} from "./schema";
import {
  archiveSource,
  createSource,
  listSourceHistory,
  listSources,
  updateSource,
  type SourceInput,
} from "./sources";
import { setUserPassword } from "./users";

afterAll(closePool);

const POLISH: SourceInput = {
  name: "Konto oszczędnościowe",
  kind: "savings",
  currency: "PLN",
  value: 0,
  note: null,
};

let userId: number;
let otherId: number;

async function createUser(): Promise<number> {
  const email = `zrodla_${randomBytes(4).toString("hex")}@example.com`;
  return (await setUserPassword(getDb(), email, "x")).userId;
}

beforeEach(async () => {
  userId = await createUser();
  otherId = await createUser();
});

afterEach(async () => {
  await getDb().delete(users).where(eq(users.id, userId));
  await getDb().delete(users).where(eq(users.id, otherId));
});

async function addGoal(sourceId: number, removed = false): Promise<number> {
  const [goal] = await getDb()
    .insert(goals)
    .values({
      userId,
      pool: "savings",
      name: "Wakacje",
      pct: 10000,
      sourceId,
      position: 0,
      removedAt: removed ? new Date() : null,
    })
    .returning({ id: goals.id });
  return goal.id;
}

/** Miesiąc z migawką jednego celu; rozliczony, gdy `settled`. */
async function addMonth(goalId: number, sourceId: number, settled: boolean) {
  const [month] = await getDb()
    .insert(months)
    .values({
      userId,
      month: settled ? "2026-08" : "2026-09",
      savingsPct: 2000,
      investmentsPct: 0,
      settledAt: settled ? new Date() : null,
    })
    .returning({ id: months.id });
  await getDb()
    .insert(monthGoals)
    .values({
      monthId: month.id,
      goalId,
      pool: "savings",
      pct: 10000,
      sourceId,
      actualAmount: settled ? 50000 : null,
    });
}

/** Czeka, aż jakieś zapytanie w bazie testowej czeka na blokadę wiersza. */
async function waitForLockWait() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const { rows } = await getPool().query(
      `select 1 from pg_stat_activity
       where datname = current_database() and wait_event_type = 'Lock'`,
    );
    if (rows.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Archiwizacja nie czekała na blokadę źródła.");
}

async function stored(id: number) {
  const [row] = await getDb().select().from(sources).where(eq(sources.id, id));
  return row;
}

describe("lista źródeł", () => {
  it("zawiera tylko niezarchiwizowane źródła danego konta, w kolejności dodania", async () => {
    const db = getDb();
    const first = await createSource(db, userId, {
      ...POLISH,
      value: 100000,
      note: "mBank",
    });
    const second = await createSource(db, userId, {
      name: "Konto EUR",
      kind: "investments",
      currency: "EUR",
      value: 0,
      note: null,
    });
    const archived = await createSource(db, userId, POLISH);
    expect(await archiveSource(db, userId, archived)).toBe("ok");
    await createSource(db, otherId, POLISH);

    expect(await listSources(db, userId)).toEqual([
      {
        id: first,
        ...POLISH,
        value: 100000,
        note: "mBank",
        inUse: false,
        kindLocked: false,
      },
      {
        id: second,
        name: "Konto EUR",
        kind: "investments",
        currency: "EUR",
        value: 0,
        note: null,
        inUse: false,
        kindLocked: false,
      },
    ]);
  });
});

describe("archiwizacja (SPEC 5.2, scen. 16)", () => {
  it("odrzuca źródło o wartości większej od 0, a po wyzerowaniu archiwizuje", async () => {
    const db = getDb();
    const id = await createSource(db, userId, { ...POLISH, value: 50000 });
    expect(await archiveSource(db, userId, id)).toBe("has-value");
    expect((await stored(id)).archivedAt).toBeNull();

    await updateSource(db, userId, id, { ...POLISH, value: 0 });
    expect(await archiveSource(db, userId, id)).toBe("ok");
    expect((await stored(id)).archivedAt).not.toBeNull();
    expect(await listSources(db, userId)).toEqual([]);
  });

  it("odrzuca źródło celu bieżącego planu", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    await addGoal(id);
    expect(await archiveSource(getDb(), userId, id)).toBe("in-use");
  });

  it("odrzuca źródło celu w planie nierozliczonego miesiąca, także celu usuniętego z planu", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    await addMonth(await addGoal(id, true), id, false);
    expect(await archiveSource(getDb(), userId, id)).toBe("in-use");
  });

  it("przyjmuje źródło celu usuniętego z planu, które występuje tylko w rozliczonych miesiącach", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    await addMonth(await addGoal(id, true), id, true);
    expect(await archiveSource(getDb(), userId, id)).toBe("ok");
  });

  it("nie dotyka źródła innego konta ani już zarchiwizowanego", async () => {
    const db = getDb();
    const foreign = await createSource(db, otherId, POLISH);
    expect(await archiveSource(db, userId, foreign)).toBe("not-found");
    expect((await stored(foreign)).archivedAt).toBeNull();

    const id = await createSource(db, userId, POLISH);
    expect(await archiveSource(db, userId, id)).toBe("ok");
    expect(await archiveSource(db, userId, id)).toBe("not-found");
  });

  it("czeka na równoległy zapis celu, który blokuje źródło, i wtedy odrzuca", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    const client = await getPool().connect();
    try {
      // Kontrakt zapisu celu z `archiveSource`: blokada źródła przed zapisem.
      await client.query("begin");
      await client.query("select id from sources where id = $1 for share", [
        id,
      ]);
      await client.query(
        `insert into goals (user_id, pool, name, pct, source_id, position)
         values ($1, 'savings', 'Wakacje', 10000, $2, 0)`,
        [userId, id],
      );
      const archiving = archiveSource(getDb(), userId, id);
      await waitForLockWait();
      await client.query("commit");
      expect(await archiving).toBe("in-use");
    } finally {
      client.release();
    }
    expect((await stored(id)).archivedAt).toBeNull();
  });
});

describe("edycja (SPEC 5.2)", () => {
  const EDITED: SourceInput = {
    name: "Nowa nazwa",
    kind: "savings",
    currency: "PLN",
    value: 1234,
    note: "notatka",
  };

  it("zapisuje nazwę, notatkę, wartość, typ i walutę niepołączonego źródła", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    const changed: SourceInput = {
      ...EDITED,
      kind: "investments",
      currency: "EUR",
    };
    expect(await updateSource(getDb(), userId, id, changed)).toBe("ok");
    expect(await stored(id)).toMatchObject(changed);
  });

  it("przy celu bieżącego planu blokuje zmianę typu i waluty, ale nie nazwy i wartości", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    await addGoal(id);
    const [row] = await listSources(getDb(), userId);
    expect(row).toMatchObject({ inUse: true, kindLocked: true });

    expect(
      await updateSource(getDb(), userId, id, {
        ...EDITED,
        kind: "investments",
      }),
    ).toBe("kind-locked");
    expect(
      await updateSource(getDb(), userId, id, { ...EDITED, currency: "EUR" }),
    ).toBe("kind-locked");
    expect(await stored(id)).toMatchObject(POLISH);

    expect(await updateSource(getDb(), userId, id, EDITED)).toBe("ok");
    expect(await stored(id)).toMatchObject(EDITED);
  });

  it("przy rozliczonych wpłatach blokuje zmianę typu i waluty, choć cel usunięto z planu", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    await addMonth(await addGoal(id, true), id, true);
    const [row] = await listSources(getDb(), userId);
    expect(row).toMatchObject({ inUse: false, kindLocked: true });
    expect(
      await updateSource(getDb(), userId, id, { ...EDITED, currency: "EUR" }),
    ).toBe("kind-locked");
  });

  it("blokuje typ i walutę źródła z migawki nierozliczonego miesiąca, choć cel usunięto z planu", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    await addMonth(await addGoal(id, true), id, false);
    const [row] = await listSources(getDb(), userId);
    expect(row).toMatchObject({ inUse: true, kindLocked: true });
    expect(
      await updateSource(getDb(), userId, id, {
        ...EDITED,
        kind: "investments",
      }),
    ).toBe("kind-locked");
  });

  it("po usunięciu celu bez miesięcy odblokowuje typ i walutę", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    await addGoal(id, true);
    expect(
      await updateSource(getDb(), userId, id, {
        ...EDITED,
        kind: "investments",
      }),
    ).toBe("ok");
  });

  it("nie zmienia źródła innego konta ani zarchiwizowanego", async () => {
    const db = getDb();
    const foreign = await createSource(db, otherId, POLISH);
    expect(await updateSource(db, userId, foreign, EDITED)).toBe("not-found");
    expect(await stored(foreign)).toMatchObject(POLISH);

    const id = await createSource(db, userId, POLISH);
    await archiveSource(db, userId, id);
    expect(await updateSource(db, userId, id, EDITED)).toBe("not-found");
  });
});

describe("historia wartości (SPEC 5.11, T17)", () => {
  async function history(id: number) {
    return getDb()
      .select({
        value: sourceValues.value,
        currency: sourceValues.currency,
        reason: sourceValues.reason,
        userId: sourceValues.userId,
      })
      .from(sourceValues)
      .where(eq(sourceValues.sourceId, id))
      .orderBy(asc(sourceValues.id));
  }

  it("dodanie źródła zapisuje punkt z wartością i walutą", async () => {
    const id = await createSource(getDb(), userId, {
      ...POLISH,
      currency: "EUR",
      value: 2500,
    });
    expect(await history(id)).toEqual([
      { value: 2500, currency: "EUR", reason: "created", userId },
    ]);
  });

  it("ręczna zmiana wartości zapisuje punkt; zmiana samej nazwy nie", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    await updateSource(getDb(), userId, id, { ...POLISH, name: "Inna" });
    await updateSource(getDb(), userId, id, { ...POLISH, value: 7000 });
    expect(await history(id)).toEqual([
      { value: 0, currency: "PLN", reason: "created", userId },
      { value: 7000, currency: "PLN", reason: "manual", userId },
    ]);
  });

  it("zmiana waluty zapisuje punkt w nowej walucie, choć liczba ta sama (SPEC 7)", async () => {
    const id = await createSource(getDb(), userId, { ...POLISH, value: 900 });
    await updateSource(getDb(), userId, id, {
      ...POLISH,
      value: 900,
      currency: "EUR",
    });
    expect((await history(id)).at(-1)).toEqual({
      value: 900,
      currency: "EUR",
      reason: "manual",
      userId,
    });
  });

  it("odrzucona edycja (zablokowana waluta) nie zostawia punktu", async () => {
    const id = await createSource(getDb(), userId, POLISH);
    await addGoal(id);
    expect(
      await updateSource(getDb(), userId, id, {
        ...POLISH,
        value: 100,
        currency: "EUR",
      }),
    ).toBe("kind-locked");
    expect(await history(id)).toHaveLength(1);
  });

  it("archiwizacja zapisuje punkt z wartością 0; odrzucona nie zapisuje", async () => {
    const id = await createSource(getDb(), userId, { ...POLISH, value: 10 });
    expect(await archiveSource(getDb(), userId, id)).toBe("has-value");
    await updateSource(getDb(), userId, id, POLISH);
    expect(await archiveSource(getDb(), userId, id)).toBe("ok");
    expect((await history(id)).map((p) => [p.reason, p.value])).toEqual([
      ["created", 10],
      ["manual", 0],
      ["archived", 0],
    ]);
  });

  it("nie zapisuje punktu dla źródła innego konta", async () => {
    const foreign = await createSource(getDb(), otherId, POLISH);
    await updateSource(getDb(), userId, foreign, { ...POLISH, value: 5 });
    await archiveSource(getDb(), userId, foreign);
    expect(await history(foreign)).toHaveLength(1);
  });
});

describe("listSourceHistory (wykres majątku, reguła 6.11)", () => {
  it("zwraca całą historię konta, także zarchiwizowanych źródeł, rosnąco", async () => {
    const active = await createSource(getDb(), userId, {
      ...POLISH,
      value: 1000,
    });
    await updateSource(getDb(), userId, active, { ...POLISH, value: 1500 });
    const gone = await createSource(getDb(), userId, { ...POLISH, value: 0 });
    await archiveSource(getDb(), userId, gone);
    // Źródło innego konta nie może wejść do wyniku.
    await createSource(getDb(), otherId, POLISH);

    const entries = await listSourceHistory(getDb(), userId);
    expect(entries).toEqual([
      expect.objectContaining({ sourceId: active, value: 1000, currency: "PLN" }),
      expect.objectContaining({ sourceId: active, value: 1500, currency: "PLN" }),
      expect.objectContaining({ sourceId: gone, value: 0, currency: "PLN" }),
      expect.objectContaining({ sourceId: gone, value: 0, currency: "PLN" }),
    ]);
    for (const e of entries) expect(e.recordedAt).toBeInstanceOf(Date);
    const times = entries.map((e) => e.recordedAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("puste konto nie ma historii", async () => {
    expect(await listSourceHistory(getDb(), userId)).toEqual([]);
  });
});

import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closePool, getDb, getPool } from "./client";
import { addIncome, deleteIncome, getMonth, updateIncome } from "./months";
import { savePlan } from "./plan";
import { incomes, monthGoals, months, sources, users } from "./schema";
import { setUserPassword } from "./users";

afterAll(closePool);

// 15 października 2026: bieżący miesiąc 2026-10, poprzedni 2026-09, a 2026-08
// jest o jeden za daleko (SPEC 5.4).
const NOW = new Date("2026-10-15T12:00:00Z");

let userId: number;
let otherId: number;

async function createUser(): Promise<number> {
  const email = `miesiace_${randomBytes(4).toString("hex")}@example.com`;
  return (await setUserPassword(getDb(), email, "x")).userId;
}

async function addSource(kind: "savings" | "investments" = "savings") {
  const [row] = await getDb()
    .insert(sources)
    .values({ userId, name: "Źródło", kind, currency: "PLN", value: 0 })
    .returning({ id: sources.id });
  return row.id;
}

/** Plan: oszczędności 20% z jednym celem 100%, reszta pusta. */
async function seedPlan() {
  const sourceId = await addSource("savings");
  await savePlan(getDb(), userId, {
    savingsPct: 2000,
    investmentsPct: 0,
    goals: [
      {
        id: null,
        pool: "savings",
        name: "Poduszka",
        pct: 10000,
        sourceId,
        targetAmount: null,
        startAmount: null,
      },
    ],
  });
  return sourceId;
}

async function snapshot(monthId: number) {
  return getDb()
    .select({
      goalId: monthGoals.goalId,
      pool: monthGoals.pool,
      pct: monthGoals.pct,
      sourceId: monthGoals.sourceId,
    })
    .from(monthGoals)
    .where(eq(monthGoals.monthId, monthId));
}

async function incomeIds(monthId: number) {
  const rows = await getDb()
    .select({ id: incomes.id })
    .from(incomes)
    .where(eq(incomes.monthId, monthId))
    .orderBy(asc(incomes.id));
  return rows.map((row) => row.id);
}

async function waitForLockWait() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const { rows } = await getPool().query(
      `select 1 from pg_stat_activity
       where datname = current_database() and wait_event_type = 'Lock'`,
    );
    if (rows.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Równoległy przychód nie czekał na blokadę.");
}

beforeEach(async () => {
  userId = await createUser();
  otherId = await createUser();
});

afterEach(async () => {
  await getDb().delete(users).where(eq(users.id, userId));
  await getDb().delete(users).where(eq(users.id, otherId));
});

describe("tworzenie miesiąca pierwszym przychodem (SPEC 5.4, Z2)", () => {
  it("tworzy bieżący miesiąc z migawką planu i zapisuje przychód", async () => {
    const sourceId = await seedPlan();
    const result = await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Pensja", amount: 850000 },
      NOW,
    );
    expect(result).toMatchObject({ status: "ok", created: true });

    const month = await getMonth(getDb(), userId, "2026-10");
    expect(month).toMatchObject({
      month: "2026-10",
      savingsPct: 2000,
      investmentsPct: 0,
      settled: false,
    });
    expect(month?.incomes).toEqual([
      { id: expect.any(Number), name: "Pensja", amount: 850000 },
    ]);
    expect(await snapshot(month!.id)).toEqual([
      { goalId: expect.any(Number), pool: "savings", pct: 10000, sourceId },
    ]);
  });

  it("dokłada kolejny przychód do istniejącego miesiąca bez tworzenia drugiego", async () => {
    await seedPlan();
    await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Pensja", amount: 850000 },
      NOW,
    );
    const second = await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Premia", amount: 130000 },
      NOW,
    );
    expect(second).toMatchObject({ status: "ok", created: false });

    const month = await getMonth(getDb(), userId, "2026-10");
    expect(month?.incomes.map((i) => i.name)).toEqual(["Pensja", "Premia"]);
    const all = await getDb()
      .select({ id: months.id })
      .from(months)
      .where(eq(months.userId, userId));
    expect(all).toHaveLength(1);
  });

  it("pozwala utworzyć poprzedni miesiąc, ale odrzuca starszy (scen. 18)", async () => {
    await seedPlan();
    expect(
      await addIncome(
        getDb(),
        userId,
        "2026-09",
        { name: "Pensja", amount: 500000 },
        NOW,
      ),
    ).toMatchObject({ status: "ok", created: true });
    expect(
      await addIncome(
        getDb(),
        userId,
        "2026-08",
        { name: "Pensja", amount: 500000 },
        NOW,
      ),
    ).toEqual({ status: "cannot-create" });
    expect(await getMonth(getDb(), userId, "2026-08")).toBeNull();
  });

  it("zachowuje migawkę miesiąca mimo późniejszej zmiany planu (scen. 8)", async () => {
    const firstSource = await seedPlan();
    await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Pensja", amount: 980000 },
      NOW,
    );
    const month = await getMonth(getDb(), userId, "2026-10");

    // Zmiana planu po utworzeniu miesiąca: inne procenty pul.
    const secondSource = await addSource("investments");
    await savePlan(getDb(), userId, {
      savingsPct: 3000,
      investmentsPct: 1000,
      goals: [
        {
          id: null,
          pool: "investments",
          name: "ETF",
          pct: 10000,
          sourceId: secondSource,
          targetAmount: null,
          startAmount: null,
        },
      ],
    });

    const unchanged = await getMonth(getDb(), userId, "2026-10");
    expect(unchanged).toMatchObject({ savingsPct: 2000, investmentsPct: 0 });
    expect(await snapshot(month!.id)).toEqual([
      {
        goalId: expect.any(Number),
        pool: "savings",
        pct: 10000,
        sourceId: firstSource,
      },
    ]);
  });

  it("dwa równoległe pierwsze przychody tworzą jeden miesiąc", async () => {
    await seedPlan();
    const client = await getPool().connect();
    try {
      await client.query("begin");
      // Pierwszy przychód w osobnym połączeniu: tworzy miesiąc, ale nie commituje.
      await client.query(
        `insert into months (user_id, month, savings_pct, investments_pct)
         values ($1, '2026-10', 2000, 0)`,
        [userId],
      );
      const concurrent = addIncome(
        getDb(),
        userId,
        "2026-10",
        { name: "Premia", amount: 130000 },
        NOW,
      );
      await waitForLockWait();
      await client.query("commit");
      expect(await concurrent).toMatchObject({ status: "ok", created: false });
    } finally {
      client.release();
    }
    const all = await getDb()
      .select({ id: months.id })
      .from(months)
      .where(eq(months.userId, userId));
    expect(all).toHaveLength(1);
  });
});

describe("edycja i blokada rozliczonego (SPEC 5.4)", () => {
  async function settle(monthId: number) {
    await getDb()
      .update(months)
      .set({ settledAt: new Date() })
      .where(eq(months.id, monthId));
  }

  it("edytuje przychód nierozliczonego miesiąca", async () => {
    await seedPlan();
    const added = await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Pensja", amount: 850000 },
      NOW,
    );
    const monthId = (added as { monthId: number }).monthId;
    const [incomeId] = await incomeIds(monthId);
    expect(
      await updateIncome(getDb(), userId, incomeId, {
        name: "Pensja netto",
        amount: 900000,
      }),
    ).toBe("ok");
    const month = await getMonth(getDb(), userId, "2026-10");
    expect(month?.incomes).toEqual([
      { id: incomeId, name: "Pensja netto", amount: 900000 },
    ]);
  });

  it("odrzuca edycję i usunięcie przychodu rozliczonego miesiąca", async () => {
    await seedPlan();
    const added = await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Pensja", amount: 850000 },
      NOW,
    );
    const monthId = (added as { monthId: number }).monthId;
    const [incomeId] = await incomeIds(monthId);
    await settle(monthId);
    expect(
      await updateIncome(getDb(), userId, incomeId, {
        name: "Pensja",
        amount: 1,
      }),
    ).toBe("settled");
    expect(await deleteIncome(getDb(), userId, incomeId)).toEqual({
      status: "settled",
    });
    expect((await getMonth(getDb(), userId, "2026-10"))?.incomes).toHaveLength(
      1,
    );
  });

  it("nie dotyka przychodu innego konta", async () => {
    await seedPlan();
    const added = await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Pensja", amount: 850000 },
      NOW,
    );
    const [incomeId] = await incomeIds((added as { monthId: number }).monthId);
    expect(
      await updateIncome(getDb(), otherId, incomeId, {
        name: "X",
        amount: 1,
      }),
    ).toBe("not-found");
    expect(await deleteIncome(getDb(), otherId, incomeId)).toEqual({
      status: "not-found",
    });
  });
});

describe("usunięcie przychodu i miesiąca (SPEC 7, P7)", () => {
  it("usuwa ostatni przychód razem z miesiącem i migawką, zostawia miesiąc z resztą", async () => {
    await seedPlan();
    const added = await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Pensja", amount: 850000 },
      NOW,
    );
    const monthId = (added as { monthId: number }).monthId;
    await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Premia", amount: 130000 },
      NOW,
    );
    const [first, second] = await incomeIds(monthId);

    expect(await deleteIncome(getDb(), userId, first)).toEqual({
      status: "ok",
      monthRemoved: false,
    });
    expect(await getMonth(getDb(), userId, "2026-10")).not.toBeNull();

    expect(await deleteIncome(getDb(), userId, second)).toEqual({
      status: "ok",
      monthRemoved: true,
    });
    expect(await getMonth(getDb(), userId, "2026-10")).toBeNull();
    expect(await snapshot(monthId)).toEqual([]);

    // Ponowny przychód tworzy miesiąc z planem obowiązującym w tej chwili.
    expect(
      await addIncome(
        getDb(),
        userId,
        "2026-10",
        { name: "Pensja", amount: 500000 },
        NOW,
      ),
    ).toMatchObject({ status: "ok", created: true });
  });

  it("dwa równoległe usunięcia dwóch ostatnich pozycji kasują miesiąc raz", async () => {
    await seedPlan();
    const added = await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Pensja", amount: 850000 },
      NOW,
    );
    const monthId = (added as { monthId: number }).monthId;
    await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "Premia", amount: 130000 },
      NOW,
    );
    const [first, second] = await incomeIds(monthId);

    const [a, b] = await Promise.all([
      deleteIncome(getDb(), userId, first),
      deleteIncome(getDb(), userId, second),
    ]);
    const removed = [a, b].filter(
      (r) => r.status === "ok" && r.monthRemoved,
    ).length;
    expect(removed).toBe(1);
    expect(await getMonth(getDb(), userId, "2026-10")).toBeNull();
  });
});

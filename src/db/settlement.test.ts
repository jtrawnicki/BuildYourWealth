import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closePool, getDb, getPool } from "./client";
import { addIncome, getMonth, getMonthSnapshot } from "./months";
import { savePlan, type PlanGoalInput } from "./plan";
import { months, sources, sourceValues, users } from "./schema";
import { settleMonth } from "./settlement";
import { setUserPassword } from "./users";

afterAll(closePool);

// 31 października 2026: 2026-10 można już rozliczyć (ostatni dzień miesiąca).
const NOW = new Date("2026-10-31T12:00:00Z");

let userId: number;

async function createUser(): Promise<number> {
  const email = `settle_${randomBytes(4).toString("hex")}@example.com`;
  return (await setUserPassword(getDb(), email, "x")).userId;
}

async function addSource(
  kind: "savings" | "investments",
  currency: "PLN" | "EUR" = "PLN",
  value = 0,
): Promise<number> {
  const [row] = await getDb()
    .insert(sources)
    .values({ userId, name: `${kind}-${currency}`, kind, currency, value })
    .returning({ id: sources.id });
  return row.id;
}

async function sourceValue(id: number): Promise<number> {
  const [row] = await getDb()
    .select({ value: sources.value })
    .from(sources)
    .where(eq(sources.id, id));
  return row.value;
}

/**
 * Plan i przychody ze scenariusza 1 (SPEC 12): przychód 9 800,00 zł, pule
 * 20%/15%, po trzy cele w każdej. Każdy cel ma własne źródło PLN; `akcjeEur`
 * robi z celu „Akcje" cel w EUR (źródło o wartości startowej `eurStart`).
 */
async function seedScenario1(
  opts: { akcjeEur?: boolean; eurStart?: number } = {},
) {
  const src: Record<string, number> = {
    poduszka: await addSource("savings"),
    wakacje: await addSource("savings"),
    rezerwa: await addSource("savings"),
    etf: await addSource("investments"),
    obligacje: await addSource("investments"),
    akcje: opts.akcjeEur
      ? await addSource("investments", "EUR", opts.eurStart ?? 0)
      : await addSource("investments"),
  };
  const goal = (
    pool: "savings" | "investments",
    name: string,
    pct: number,
    sourceId: number,
    startAmount: number | null = null,
    targetAmount: number | null = null,
  ): PlanGoalInput => ({
    id: null,
    pool,
    name,
    pct,
    sourceId,
    targetAmount,
    startAmount,
    deadline: null,
  });
  await savePlan(getDb(), userId, {
    savingsPct: 2000,
    investmentsPct: 1500,
    goals: [
      goal("savings", "Poduszka", 5000, src.poduszka),
      goal("savings", "Wakacje", 3000, src.wakacje),
      goal("savings", "Rezerwa", 2000, src.rezerwa),
      goal("investments", "ETF", 6000, src.etf),
      goal("investments", "Obligacje", 2500, src.obligacje),
      goal("investments", "Akcje", 1500, src.akcje),
    ],
  });
  await addIncome(
    getDb(),
    userId,
    "2026-10",
    { name: "Pensja", amount: 850000 },
    NOW,
  );
  await addIncome(
    getDb(),
    userId,
    "2026-10",
    { name: "Premia", amount: 130000 },
    NOW,
  );
  return src;
}

async function goalId(monthId: number, name: string): Promise<number> {
  const snapshot = await getMonthSnapshot(getDb(), monthId);
  const goal = snapshot.find((g) => g.name === name);
  if (!goal) throw new Error(`Brak celu ${name} w migawce`);
  return goal.goalId;
}

beforeEach(async () => {
  userId = await createUser();
});

afterEach(async () => {
  await getDb().delete(users).where(eq(users.id, userId));
});

describe("rozliczenie zgodne z planem (SPEC 5.5, scen. 4)", () => {
  it("dopisuje zaplanowane kwoty do źródeł i oznacza miesiąc jako rozliczony", async () => {
    const src = await seedScenario1();
    const result = await settleMonth(
      getDb(),
      userId,
      "2026-10",
      { mode: "plan" },
      null,
    );
    expect(result).toEqual({ status: "ok" });

    expect(await sourceValue(src.poduszka)).toBe(98000);
    expect(await sourceValue(src.wakacje)).toBe(58800);
    expect(await sourceValue(src.rezerwa)).toBe(39200);
    expect(await sourceValue(src.etf)).toBe(88200);
    expect(await sourceValue(src.obligacje)).toBe(36750);
    expect(await sourceValue(src.akcje)).toBe(22050);

    const month = await getMonth(getDb(), userId, "2026-10");
    expect(month).toMatchObject({ settled: true, settledEurRate: null });
  });
});

describe("rozliczenie częściowe (SPEC 5.5, scen. 5)", () => {
  it("zapisuje wpisane kwoty, a nie plan; historia zna plan i wykonanie", async () => {
    const src = await seedScenario1();
    const month = await getMonth(getDb(), userId, "2026-10");
    const actuals = [
      { goalId: await goalId(month!.id, "Poduszka"), amount: 50000 },
      { goalId: await goalId(month!.id, "Wakacje"), amount: 58800 },
      { goalId: await goalId(month!.id, "Rezerwa"), amount: 39200 },
      { goalId: await goalId(month!.id, "ETF"), amount: 88200 },
      { goalId: await goalId(month!.id, "Obligacje"), amount: 36750 },
      { goalId: await goalId(month!.id, "Akcje"), amount: 22050 },
    ];
    expect(
      await settleMonth(
        getDb(),
        userId,
        "2026-10",
        { mode: "manual", actuals },
        null,
      ),
    ).toEqual({ status: "ok" });

    // Poduszka: wpłata 500,00 zamiast planu 980,00.
    expect(await sourceValue(src.poduszka)).toBe(50000);
    const snapshot = await getMonthSnapshot(getDb(), month!.id);
    const poduszka = snapshot.find((g) => g.name === "Poduszka")!;
    expect(poduszka.actualAmount).toBe(50000);
  });

  it("odrzuca ręczne rozliczenie bez kwoty dla któregoś celu", async () => {
    const month = await (async () => {
      await seedScenario1();
      return getMonth(getDb(), userId, "2026-10");
    })();
    const actuals = [
      { goalId: await goalId(month!.id, "Poduszka"), amount: 1 },
    ];
    expect(
      await settleMonth(
        getDb(),
        userId,
        "2026-10",
        { mode: "manual", actuals },
        null,
      ),
    ).toEqual({ status: "invalid" });
    // Nic się nie zapisało: miesiąc nadal otwarty.
    expect((await getMonth(getDb(), userId, "2026-10"))?.settled).toBe(false);
  });
});

describe("cel w EUR (SPEC 5.5, 6.8, scen. 6)", () => {
  it("przelicza plan po kursie i dopisuje eurocenty do źródła EUR", async () => {
    const src = await seedScenario1({ akcjeEur: true, eurStart: 100000 });

    // Kurs ustala wcześniej akcja (reguła 6.10); warstwa db dostaje go w parametrze.
    expect(
      await settleMonth(
        getDb(),
        userId,
        "2026-10",
        { mode: "plan" },
        {
          source: "fallback",
          rate: 43000,
        },
      ),
    ).toEqual({ status: "ok" });

    // 220,50 zł → 51,28 €; źródło 1 000,00 € → 1 051,28 €.
    expect(await sourceValue(src.akcje)).toBe(105128);
    const month = await getMonth(getDb(), userId, "2026-10");
    expect(month).toMatchObject({ settled: true, settledEurRate: 43000 });
    const [stored] = await getDb()
      .select({
        source: months.settledRateSource,
        date: months.settledRateDate,
      })
      .from(months)
      .where(eq(months.id, month!.id));
    expect(stored).toEqual({ source: "fallback", date: null });
  });

  it("zapisuje datę tabeli dla kursu NBP", async () => {
    await seedScenario1({ akcjeEur: true, eurStart: 100000 });
    expect(
      await settleMonth(
        getDb(),
        userId,
        "2026-10",
        { mode: "plan" },
        {
          source: "nbp",
          rate: 42650,
          date: "2026-10-30",
        },
      ),
    ).toEqual({ status: "ok" });
    const month = await getMonth(getDb(), userId, "2026-10");
    const [stored] = await getDb()
      .select({
        rate: months.settledEurRate,
        source: months.settledRateSource,
        date: months.settledRateDate,
      })
      .from(months)
      .where(eq(months.id, month!.id));
    expect(stored).toEqual({ rate: 42650, source: "nbp", date: "2026-10-30" });
  });

  it("odmawia rozliczenia celu w EUR bez ustalonego kursu (SPEC 7)", async () => {
    await seedScenario1({ akcjeEur: true });
    expect(
      await settleMonth(getDb(), userId, "2026-10", { mode: "plan" }, null),
    ).toEqual({ status: "no-rate" });
    expect((await getMonth(getDb(), userId, "2026-10"))?.settled).toBe(false);
  });
});

describe("postęp celu po rozliczeniu (SPEC 6.6, scen. 11)", () => {
  it("sumuje kwotę startową i rozliczone wpłaty, niezależnie od wartości źródła", async () => {
    const poduszka = await addSource("savings");
    await savePlan(getDb(), userId, {
      savingsPct: 10000,
      investmentsPct: 0,
      goals: [
        {
          id: null,
          pool: "savings",
          name: "Poduszka",
          pct: 10000,
          sourceId: poduszka,
          targetAmount: 500000,
          startAmount: 200000,
          deadline: null,
        },
      ],
    });
    // Dwa miesiące z wpłatami 588,00 i 512,00 (razem 1 100,00).
    await addIncome(
      getDb(),
      userId,
      "2026-09",
      { name: "P", amount: 58800 },
      NOW,
    );
    await addIncome(
      getDb(),
      userId,
      "2026-10",
      { name: "P", amount: 51200 },
      NOW,
    );
    await settleMonth(getDb(), userId, "2026-09", { mode: "plan" }, null);
    await settleMonth(getDb(), userId, "2026-10", { mode: "plan" }, null);

    const month = await getMonth(getDb(), userId, "2026-10");
    const snapshot = await getMonthSnapshot(getDb(), month!.id);
    // 2 000,00 + 588,00 + 512,00 = 3 100,00.
    expect(snapshot[0].progress).toBe(310000);

    // Ręczne zmniejszenie wartości źródła nie zmienia postępu celu.
    await getDb()
      .update(sources)
      .set({ value: 0 })
      .where(eq(sources.id, poduszka));
    const after = await getMonthSnapshot(getDb(), month!.id);
    expect(after[0].progress).toBe(310000);
  });
});

describe("jednorazowość i współbieżność (SPEC 5.5, scen. 15)", () => {
  it("odrzuca drugie rozliczenie tego samego miesiąca", async () => {
    const src = await seedScenario1();
    expect(
      await settleMonth(getDb(), userId, "2026-10", { mode: "plan" }, null),
    ).toEqual({ status: "ok" });
    expect(
      await settleMonth(getDb(), userId, "2026-10", { mode: "plan" }, null),
    ).toEqual({ status: "already-settled" });
    // Wartość źródła zmieniła się tylko raz.
    expect(await sourceValue(src.poduszka)).toBe(98000);
  });

  it("dwa równoległe rozliczenia zmieniają źródła tylko raz", async () => {
    const src = await seedScenario1();
    const client = await getPool().connect();
    try {
      await client.query("begin");
      // Pierwsze rozliczenie w osobnym połączeniu: blokuje wiersz miesiąca.
      await client.query(
        `select id from months where user_id = $1 and month = '2026-10' for update`,
        [userId],
      );
      const concurrent = settleMonth(
        getDb(),
        userId,
        "2026-10",
        { mode: "plan" },
        null,
      );
      // Czekamy, aż równoległe rozliczenie utknie na blokadzie wiersza miesiąca.
      for (let attempt = 0; attempt < 100; attempt++) {
        const { rows } = await getPool().query(
          `select 1 from pg_stat_activity
           where datname = current_database() and wait_event_type = 'Lock'`,
        );
        if (rows.length > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      // To połączenie rozlicza miesiąc i commituje.
      await client.query(
        `update months set settled_at = now() where user_id = $1 and month = '2026-10'`,
        [userId],
      );
      await client.query(
        `update sources set value = value + 98000 where id = $1`,
        [src.poduszka],
      );
      await client.query("commit");
      expect(await concurrent).toEqual({ status: "already-settled" });
    } finally {
      client.release();
    }
    expect(await sourceValue(src.poduszka)).toBe(98000);
  });

  it("równoległe rozliczenie blokuje dopisanie przychodu do miesiąca", async () => {
    await seedScenario1();
    const client = await getPool().connect();
    try {
      await client.query("begin");
      // Rozliczenie (inne połączenie) trzyma blokadę wiersza miesiąca.
      await client.query(
        `select id from months where user_id = $1 and month = '2026-10' for update`,
        [userId],
      );
      const concurrent = addIncome(
        getDb(),
        userId,
        "2026-10",
        { name: "Spóźniony", amount: 10000 },
        NOW,
      );
      // addIncome musi poczekać na blokadę wiersza miesiąca (nowy `for update`).
      for (let attempt = 0; attempt < 100; attempt++) {
        const { rows } = await getPool().query(
          `select 1 from pg_stat_activity
           where datname = current_database() and wait_event_type = 'Lock'`,
        );
        if (rows.length > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      // Rozliczenie commituje: miesiąc staje się rozliczony.
      await client.query(
        `update months set settled_at = now() where user_id = $1 and month = '2026-10'`,
        [userId],
      );
      await client.query("commit");
      // Po odblokowaniu addIncome widzi rozliczony miesiąc i odmawia.
      expect(await concurrent).toEqual({ status: "settled" });
    } finally {
      client.release();
    }
    // Spóźniony przychód nie trafił do rozliczonego miesiąca.
    const month = await getMonth(getDb(), userId, "2026-10");
    expect(month?.incomes.some((item) => item.name === "Spóźniony")).toBe(
      false,
    );
  });
});

describe("miesiąc nieistniejący", () => {
  it("zwraca not-found", async () => {
    expect(
      await settleMonth(getDb(), userId, "2026-10", { mode: "plan" }, null),
    ).toEqual({ status: "not-found" });
  });
});

describe("historia wartości przy rozliczeniu (SPEC 5.11, T17)", () => {
  async function history() {
    return getDb()
      .select({
        sourceId: sourceValues.sourceId,
        value: sourceValues.value,
        currency: sourceValues.currency,
        reason: sourceValues.reason,
        recordedAt: sourceValues.recordedAt,
      })
      .from(sourceValues)
      .where(eq(sourceValues.userId, userId))
      .orderBy(asc(sourceValues.id));
  }

  it("zapisuje punkt każdego źródła z wpłatą, w walucie źródła i z chwilą rozliczenia", async () => {
    const src = await seedScenario1({ akcjeEur: true, eurStart: 1000 });
    expect(
      await settleMonth(
        getDb(),
        userId,
        "2026-10",
        { mode: "plan" },
        {
          source: "fallback",
          rate: 43000,
        },
      ),
    ).toEqual({ status: "ok" });

    const points = await history();
    expect(points).toHaveLength(6);
    for (const p of points) expect(p.reason).toBe("settlement");
    for (const [name, id] of Object.entries(src)) {
      const point = points.find((p) => p.sourceId === id);
      expect(point?.value, name).toBe(await sourceValue(id));
      expect(point?.currency, name).toBe(name === "akcje" ? "EUR" : "PLN");
    }
    const month = await getMonth(getDb(), userId, "2026-10");
    const [settled] = await getDb()
      .select({ settledAt: months.settledAt })
      .from(months)
      .where(eq(months.id, month!.id));
    for (const p of points) expect(p.recordedAt).toEqual(settled.settledAt);
  });

  it("odrzucone drugie rozliczenie nie zostawia wpisu (scen. 15)", async () => {
    await seedScenario1();
    await settleMonth(getDb(), userId, "2026-10", { mode: "plan" }, null);
    const before = await history();
    expect(
      await settleMonth(getDb(), userId, "2026-10", { mode: "plan" }, null),
    ).toEqual({ status: "already-settled" });
    expect(await history()).toEqual(before);
  });

  it("źródło z wpłatą 0 nie dostaje punktu", async () => {
    const src = await seedScenario1();
    const month = await getMonth(getDb(), userId, "2026-10");
    const snapshot = await getMonthSnapshot(getDb(), month!.id);
    const actuals = snapshot.map((g) => ({
      goalId: g.goalId,
      amount: g.name === "Poduszka" ? 0 : 100,
    }));
    await settleMonth(
      getDb(),
      userId,
      "2026-10",
      { mode: "manual", actuals },
      null,
    );
    const ids = (await history()).map((p) => p.sourceId);
    expect(ids).toHaveLength(5);
    expect(ids).not.toContain(src.poduszka);
  });
});

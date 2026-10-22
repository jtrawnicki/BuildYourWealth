import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closePool, getDb } from "./client";
import {
  getPlan,
  listPlanSources,
  savePlan,
  type PlanGoalInput,
  type PlanInput,
} from "./plan";
import { goals, monthGoals, months, sources, users } from "./schema";
import { setUserPassword } from "./users";

afterAll(closePool);

let userId: number;
let otherId: number;

async function createUser(): Promise<number> {
  const email = `plan_${randomBytes(4).toString("hex")}@example.com`;
  return (await setUserPassword(getDb(), email, "x")).userId;
}

async function addSource(options: {
  kind?: "savings" | "investments";
  currency?: "PLN" | "EUR";
  user?: number;
}): Promise<number> {
  const [row] = await getDb()
    .insert(sources)
    .values({
      userId: options.user ?? userId,
      name: "Źródło",
      kind: options.kind ?? "savings",
      currency: options.currency ?? "PLN",
      value: 0,
    })
    .returning({ id: sources.id });
  return row.id;
}

/** Miesiąc z migawką celu; rozliczony, gdy `settled`. */
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

const goal = (over: Partial<PlanGoalInput>): PlanGoalInput => ({
  id: null,
  pool: "savings",
  name: "Cel",
  pct: 10000,
  sourceId: 0,
  targetAmount: null,
  startAmount: null,
  ...over,
});

async function activeGoals() {
  return getDb()
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.removedAt)))
    .orderBy(goals.position, goals.id);
}

beforeEach(async () => {
  userId = await createUser();
  otherId = await createUser();
});

afterEach(async () => {
  // Kaskada po użytkowniku sprząta ustawienia, cele, miesiące i źródła.
  await getDb().delete(users).where(eq(users.id, userId));
  await getDb().delete(users).where(eq(users.id, otherId));
});

describe("getPlan i listPlanSources", () => {
  it("zwraca procenty pul i cele w kolejności dodania, z walutą źródła", async () => {
    const save = await addSource({ kind: "savings" });
    const invest = await addSource({ kind: "investments", currency: "EUR" });
    await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 1500,
      goals: [
        goal({ pool: "savings", name: "Poduszka", pct: 6000, sourceId: save }),
        goal({ pool: "savings", name: "Wakacje", pct: 4000, sourceId: save }),
        goal({
          pool: "investments",
          name: "ETF",
          pct: 10000,
          sourceId: invest,
          targetAmount: 500000,
        }),
      ],
    });

    const plan = await getPlan(getDb(), userId);
    expect(plan.savingsPct).toBe(2000);
    expect(plan.investmentsPct).toBe(1500);
    expect(plan.goals.map((g) => g.name)).toEqual([
      "Poduszka",
      "Wakacje",
      "ETF",
    ]);
    expect(plan.goals[2]).toMatchObject({
      currency: "EUR",
      targetAmount: 500000,
      hasSettled: false,
    });

    const list = await listPlanSources(getDb(), userId);
    expect(list.map((s) => s.id)).toEqual([save, invest]);
  });

  it("nowy użytkownik ma puste pule i brak celów", async () => {
    const plan = await getPlan(getDb(), userId);
    expect(plan).toEqual({ savingsPct: 0, investmentsPct: 0, goals: [] });
  });

  it("listPlanSources pomija zarchiwizowane źródła", async () => {
    const live = await addSource({});
    const archived = await addSource({});
    await getDb()
      .update(sources)
      .set({ archivedAt: new Date() })
      .where(eq(sources.id, archived));
    const list = await listPlanSources(getDb(), userId);
    expect(list.map((s) => s.id)).toEqual([live]);
  });
});

describe("savePlan", () => {
  it("zapisuje pule i cele razem, aktualizuje istniejące i miękko usuwa pozostałe", async () => {
    const source = await addSource({});
    await savePlan(getDb(), userId, {
      savingsPct: 3000,
      investmentsPct: 0,
      goals: [
        goal({ name: "A", pct: 5000, sourceId: source }),
        goal({ name: "B", pct: 5000, sourceId: source }),
      ],
    });
    const first = await activeGoals();

    const result = await savePlan(getDb(), userId, {
      savingsPct: 4000,
      investmentsPct: 0,
      goals: [
        goal({ id: first[0].id, name: "A2", pct: 10000, sourceId: source }),
      ],
    });
    expect(result).toEqual({ status: "ok" });

    const plan = await getPlan(getDb(), userId);
    expect(plan.savingsPct).toBe(4000);
    expect(plan.goals.map((g) => g.name)).toEqual(["A2"]);
    expect(plan.goals[0].id).toBe(first[0].id);

    // Usunięty cel zostaje w bazie z `removedAt` (nie znika z historii, SPEC 5.3).
    const [removed] = await getDb()
      .select({ removedAt: goals.removedAt })
      .from(goals)
      .where(eq(goals.id, first[1].id));
    expect(removed.removedAt).not.toBeNull();
  });

  it("odrzuca zmianę waluty źródła celu z kwotą docelową (SPEC 6.9)", async () => {
    const pln = await addSource({ currency: "PLN" });
    const eur = await addSource({ currency: "EUR" });
    await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [
        goal({ name: "Cel", pct: 10000, sourceId: pln, targetAmount: 100000 }),
      ],
    });
    const [existing] = await activeGoals();

    const result = await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [
        goal({
          id: existing.id,
          name: "Cel",
          pct: 10000,
          sourceId: eur,
          targetAmount: 100000,
        }),
      ],
    });
    expect(result).toEqual({ status: "currency-locked", goalName: "Cel" });
    // Nic się nie zapisało: cel dalej wskazuje złotowe źródło.
    const [after] = await activeGoals();
    expect(after.sourceId).toBe(pln);
  });

  it("odrzuca zmianę waluty, gdy cel ma rozliczone wpłaty, choć bez kwot", async () => {
    const pln = await addSource({ currency: "PLN" });
    const eur = await addSource({ currency: "EUR" });
    await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [goal({ name: "Cel", pct: 10000, sourceId: pln })],
    });
    const [existing] = await activeGoals();
    await addMonth(existing.id, pln, true);

    const result = await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [
        goal({ id: existing.id, name: "Cel", pct: 10000, sourceId: eur }),
      ],
    });
    expect(result).toEqual({ status: "currency-locked", goalName: "Cel" });
  });

  it("pozwala zmienić walutę, gdy cel nie ma kwot ani rozliczeń", async () => {
    const pln = await addSource({ currency: "PLN" });
    const eur = await addSource({ currency: "EUR" });
    await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [goal({ name: "Cel", pct: 10000, sourceId: pln })],
    });
    const [existing] = await activeGoals();

    const result = await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [
        goal({ id: existing.id, name: "Cel", pct: 10000, sourceId: eur }),
      ],
    });
    expect(result).toEqual({ status: "ok" });
    const [after] = await activeGoals();
    expect(after.sourceId).toBe(eur);
  });

  it("odrzuca cel ze źródłem innego typu niż pula i nic nie zapisuje", async () => {
    const investSource = await addSource({ kind: "investments" });
    const plan: PlanInput = {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [goal({ pool: "savings", sourceId: investSource })],
    };
    const result = await savePlan(getDb(), userId, plan);
    expect(result).toEqual({ status: "source-missing", goalName: "Cel" });
    expect(await getPlan(getDb(), userId)).toMatchObject({ savingsPct: 0 });
  });

  it("odrzuca cel ze źródłem cudzego konta", async () => {
    const foreign = await addSource({ user: otherId });
    const result = await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [goal({ sourceId: foreign })],
    });
    expect(result).toEqual({ status: "source-missing", goalName: "Cel" });
  });

  it("odrzuca cel ze źródłem zarchiwizowanym", async () => {
    const source = await addSource({});
    await getDb()
      .update(sources)
      .set({ archivedAt: new Date() })
      .where(eq(sources.id, source));
    const result = await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [goal({ sourceId: source })],
    });
    expect(result).toEqual({ status: "source-missing", goalName: "Cel" });
  });

  it("odrzuca nieaktualne id celu (plan się zmienił)", async () => {
    const source = await addSource({});
    const result = await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [goal({ id: 999999, sourceId: source })],
    });
    expect(result).toEqual({ status: "stale" });
  });

  it("zapisuje pusty plan (zero pul i celów)", async () => {
    const source = await addSource({});
    await savePlan(getDb(), userId, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [goal({ sourceId: source })],
    });
    const result = await savePlan(getDb(), userId, {
      savingsPct: 0,
      investmentsPct: 0,
      goals: [],
    });
    expect(result).toEqual({ status: "ok" });
    expect(await getPlan(getDb(), userId)).toMatchObject({
      savingsPct: 0,
      goals: [],
    });
  });
});

import { describe, expect, it } from "vitest";
import { computeMonthPlan, validatePlan } from "@/domain/plan";
import { currentMonth, previousMonth } from "@/domain/time";
import { generateDemoData, type DemoData } from "./generate";

// Prosty, powtarzalny PRNG (mulberry32), żeby testy generatora były
// deterministyczne i mogły przejść wiele ziaren.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const NAME_OK = (s: string) => s.length >= 1 && s.length <= 60;

// Daty wejścia do przetestowania: 1. i ostatni dzień miesiąca, przełom roku,
// zmiana czasu letniego w Polsce (ostatnia niedziela marca) i zwykły dzień.
const DATES = [
  new Date("2026-01-01T06:00:00Z"),
  new Date("2026-01-31T23:30:00Z"),
  new Date("2026-12-31T23:30:00Z"),
  new Date("2026-03-29T00:30:00Z"),
  new Date("2026-10-25T12:00:00Z"),
];
const SEEDS = [1, 2, 7, 42, 123, 9999, 2026, 31337];

/** Wpłata miesiąca na źródło (suma faktycznych kwot jego celów). */
function monthDeltaBySource(
  data: DemoData,
  month: DemoData["months"][number],
): Map<string, number> {
  const sourceOf = new Map(data.goals.map((g) => [g.key, g.sourceKey]));
  const delta = new Map<string, number>();
  for (const mg of month.goals) {
    const src = sourceOf.get(mg.goalKey)!;
    delta.set(src, (delta.get(src) ?? 0) + (mg.actualAmount ?? 0));
  }
  return delta;
}

/** Ostatni dzień miesiąca `YYYY-MM` o 23:59:59 w Europe/Warsaw (górna granica). */
function monthEndUpperBound(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  // Północ UTC pierwszego dnia następnego miesiąca to najwyżej 01:00/02:00
  // czasu polskiego, więc koniec miesiąca w Warszawie jest wcześniej.
  return new Date(Date.UTC(year, month, 1) - 2 * 60 * 60 * 1000);
}

/**
 * Historia wartości generatora: daty rosnące i przed `now`, 12 miesięcy,
 * ręczna wycena, rozliczenia po końcu miesiąca, punkty rozliczeń zgodne
 * z wpłatami, ostatni punkt każdego źródła = jego bieżąca wartość.
 */
function checkHistory(data: DemoData, now: Date): void {
  const { history } = data;
  for (let i = 1; i < history.length; i++) {
    expect(history[i].recordedAt.getTime()).toBeGreaterThanOrEqual(
      history[i - 1].recordedAt.getTime(),
    );
  }
  for (const p of history) {
    expect(p.recordedAt.getTime()).toBeLessThan(now.getTime());
    expect(p.value).toBeGreaterThanOrEqual(0);
    expect(Number.isSafeInteger(p.value)).toBe(true);
  }

  // Pierwszy punkt każdego źródła to dodanie, w miesiącu sprzed 11 miesięcy.
  let first = currentMonth(now);
  for (let i = 0; i < 11; i++) first = previousMonth(first);
  for (const s of data.sources) {
    const points = history.filter((p) => p.sourceKey === s.key);
    expect(points[0].reason).toBe("created");
    expect(currentMonth(points[0].recordedAt)).toBe(first);
    expect(points.filter((p) => p.reason === "created")).toHaveLength(1);
    expect(points.at(-1)!.value).toBe(s.value);
  }
  expect(history.some((p) => p.reason === "manual")).toBe(true);

  // Rozliczenia: data po końcu rozliczanego miesiąca, w pierwszych dniach
  // następnego, przed `now`; punkt = poprzednia wartość źródła + wpłata.
  for (const m of data.months) {
    if (!m.settled) {
      expect(m.settledAt).toBeNull();
      continue;
    }
    const at = m.settledAt!;
    expect(at.getTime()).toBeGreaterThan(monthEndUpperBound(m.month).getTime());
    expect(at.getTime()).toBeLessThan(now.getTime());
    expect(previousMonth(currentMonth(at))).toBe(m.month);
    expect(
      Number(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Warsaw",
          day: "numeric",
        }).format(at),
      ),
    ).toBeLessThanOrEqual(5);

    for (const [sourceKey, delta] of monthDeltaBySource(data, m)) {
      const index = history.findIndex(
        (p) =>
          p.sourceKey === sourceKey &&
          p.reason === "settlement" &&
          p.recordedAt.getTime() === at.getTime(),
      );
      if (delta === 0) {
        expect(index).toBe(-1);
        continue;
      }
      expect(index).toBeGreaterThan(-1);
      const before = history
        .slice(0, index)
        .filter((p) => p.sourceKey === sourceKey)
        .at(-1);
      expect(history[index].value).toBe((before?.value ?? 0) + delta);
    }
  }
  const settlements = history.filter((p) => p.reason === "settlement");
  const expected = data.months
    .filter((m) => m.settled)
    .flatMap((m) => [...monthDeltaBySource(data, m).values()])
    .filter((d) => d > 0);
  expect(settlements).toHaveLength(expected.length);
}

/** Postęp celu: kwota startowa + suma rozliczonych wpłat (SPEC 6.6). */
function goalProgressOf(data: DemoData, goalKey: string): number {
  const start = data.goals.find((g) => g.key === goalKey)?.startAmount ?? 0;
  let paid = 0;
  for (const month of data.months) {
    if (!month.settled) continue;
    const mg = month.goals.find((g) => g.goalKey === goalKey);
    paid += mg?.actualAmount ?? 0;
  }
  return start + paid;
}

describe("generator danych demo (SPEC 5.8, T16)", () => {
  for (const date of DATES) {
    for (const seed of SEEDS) {
      it(`spełnia walidację, reguły SPEC 6 i ograniczenia bazy (${date.toISOString()}, seed ${seed})`, () => {
        const data = generateDemoData(date, mulberry32(seed));

        // Walidacja planu podziału (SPEC 7.1) — bez problemów.
        expect(
          validatePlan({
            savingsPct: data.savingsPct,
            investmentsPct: data.investmentsPct,
            goals: data.goals.map((g) => ({ pool: g.pool, pct: g.pct })),
          }),
        ).toEqual([]);

        // Kurs i ograniczenia bazy dla kwot, procentów i nazw.
        expect(data.eurRate).toBeGreaterThan(0);
        for (const s of data.sources) {
          expect(NAME_OK(s.name)).toBe(true);
          expect(s.value).toBeGreaterThanOrEqual(0);
          expect(Number.isSafeInteger(s.value)).toBe(true);
        }
        for (const g of data.goals) {
          expect(g.pct).toBeGreaterThan(0);
          expect(g.pct).toBeLessThanOrEqual(10000);
          expect(NAME_OK(g.name)).toBe(true);
          if (g.targetAmount !== null)
            expect(g.targetAmount).toBeGreaterThanOrEqual(0);
          if (g.startAmount !== null)
            expect(g.startAmount).toBeGreaterThanOrEqual(0);
        }
        for (const m of data.months) {
          expect(m.month).toMatch(MONTH_PATTERN);
          expect(m.savingsPct + m.investmentsPct).toBeLessThanOrEqual(10000);
          expect(m.incomes.length).toBeGreaterThanOrEqual(1);
          for (const inc of m.incomes) {
            expect(inc.amount).toBeGreaterThan(0);
            expect(NAME_OK(inc.name)).toBe(true);
          }
          if (m.settled) {
            expect(m.settledEurRate).toBe(data.eurRate);
            for (const mg of m.goals)
              expect(mg.actualAmount).toBeGreaterThanOrEqual(0);
          } else {
            expect(m.settledEurRate).toBeNull();
            for (const mg of m.goals) expect(mg.actualAmount).toBeNull();
          }
        }

        // Historia wartości (SPEC 5.8, 5.11, T17).
        checkHistory(data, date);

        // Oś czasu: bieżący i poprzedni otwarte, trzy wcześniejsze rozliczone.
        const current = currentMonth(date);
        const previous = previousMonth(current);
        const byMonth = new Map(data.months.map((m) => [m.month, m]));
        expect(byMonth.get(current)?.settled).toBe(false);
        expect(byMonth.get(previous)?.settled).toBe(false);
        expect(data.months.filter((m) => m.settled)).toHaveLength(3);
        // Każdy miesiąc ma pełną migawkę pięciu celów.
        for (const m of data.months) expect(m.goals).toHaveLength(5);
        // Klucze miesięcy są różne.
        expect(new Set(data.months.map((m) => m.month)).size).toBe(
          data.months.length,
        );

        // Role celów (SPEC 5.8): osiągnięty, w toku, bez kwoty docelowej, EUR.
        const reached = data.goals.filter(
          (g) =>
            g.targetAmount !== null &&
            goalProgressOf(data, g.key) >= g.targetAmount,
        );
        const inProgress = data.goals.filter(
          (g) =>
            g.targetAmount !== null &&
            goalProgressOf(data, g.key) < g.targetAmount,
        );
        const noTarget = data.goals.filter((g) => g.targetAmount === null);
        expect(reached.length).toBeGreaterThanOrEqual(1);
        expect(inProgress.length).toBeGreaterThanOrEqual(1);
        expect(noTarget.length).toBeGreaterThanOrEqual(1);
        const eurGoal = data.goals.find(
          (g) =>
            data.sources.find((s) => s.key === g.sourceKey)?.currency === "EUR",
        );
        expect(eurGoal).toBeDefined();
        expect(data.sources.some((s) => s.currency === "EUR")).toBe(true);
      });
    }
  }

  it("jest deterministyczny dla tego samego ziarna", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(generateDemoData(now, mulberry32(42))).toEqual(
      generateDemoData(now, mulberry32(42)),
    );
  });

  it("co najmniej jeden rozliczony miesiąc ma wykonanie różne od planu", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    for (const seed of SEEDS) {
      const data = generateDemoData(now, mulberry32(seed));
      // Poduszka (cel PLN) w „odmiennym" miesiącu jest wpłacona częściowo.
      const hasOdd = data.months
        .filter((m) => m.settled)
        .some((m) => {
          const plan = computeMonthPlan({
            income: m.incomes.reduce((sum, i) => sum + i.amount, 0),
            savingsPct: m.savingsPct,
            investmentsPct: m.investmentsPct,
            goals: data.goals.map((g, id) => ({
              id,
              pool: g.pool,
              pct: g.pct,
            })),
          });
          const index = data.goals.findIndex((g) => g.key === "poduszka");
          const planned = plan.goals.find((g) => g.id === index)!.amount;
          const actual = m.goals.find((g) => g.goalKey === "poduszka");
          return actual?.actualAmount !== planned;
        });
      expect(hasOdd).toBe(true);
    }
  });
});

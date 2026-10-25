import { describe, expect, it } from "vitest";
import { validatePlan } from "@/domain/plan";
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

/** Delta źródła ze wszystkich rozliczonych miesięcy (suma wpłat jego celów). */
function settledDeltaBySource(data: DemoData): Map<string, number> {
  const sourceOf = new Map(data.goals.map((g) => [g.key, g.sourceKey]));
  const delta = new Map<string, number>(data.sources.map((s) => [s.key, 0]));
  for (const month of data.months) {
    if (!month.settled) continue;
    for (const mg of month.goals) {
      const src = sourceOf.get(mg.goalKey)!;
      delta.set(src, (delta.get(src) ?? 0) + (mg.actualAmount ?? 0));
    }
  }
  return delta;
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

        // Wartość źródła = początek + rozliczone wpłaty (SPEC 6.7): początek ≥ 0.
        const delta = settledDeltaBySource(data);
        for (const s of data.sources) {
          expect(s.value - (delta.get(s.key) ?? 0)).toBeGreaterThanOrEqual(0);
        }

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
    const data = generateDemoData(now, mulberry32(5));
    // Poduszka w „odmiennym" miesiącu jest zmniejszona względem planu, więc
    // suma jej wpłat jest mniejsza niż suma pozostałych rozliczonych celów puli.
    const settled = data.months.filter((m) => m.settled);
    const hasOdd = settled.some((m) => {
      const poduszka = m.goals.find((g) => g.goalKey === "poduszka");
      const wakacje = m.goals.find((g) => g.goalKey === "wakacje");
      // plan: Poduszka 50% puli, Wakacje 30% → zwykle Poduszka > Wakacje.
      return (poduszka?.actualAmount ?? 0) < (wakacje?.actualAmount ?? 0);
    });
    expect(hasOdd).toBe(true);
  });
});

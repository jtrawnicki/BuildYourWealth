import { describe, expect, it } from "vitest";
import {
  netWorthChart,
  type ChartHistoryEntry,
} from "./networth-chart";

type RawEntry = {
  sourceId: number;
  value: number;
  currency: "PLN" | "EUR";
  recordedAt: string;
};

/** Buduje historię posortowaną rosnąco po chwili zapisu, jak warstwa `db/`. */
function history(entries: RawEntry[]): ChartHistoryEntry[] {
  return entries
    .map((e) => ({ ...e, recordedAt: new Date(e.recordedAt) }))
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
}

/** Kurs na dzień z mapy `YYYY-MM-DD` → kurs; brak wpisu = brak kursu. */
function ratesFrom(map: Record<string, number>) {
  return (day: string) => map[day] ?? null;
}

describe("netWorthChart — reguła 6.11 (SPEC 5.11)", () => {
  it("scenariusz 25: punkt końca miesiąca z rozliczeniem i źródłem EUR", () => {
    const h = history([
      { sourceId: 1, value: 1_000_000, currency: "PLN", recordedAt: "2026-11-01T09:00:00Z" },
      { sourceId: 2, value: 100_000, currency: "EUR", recordedAt: "2026-11-01T09:00:00Z" },
      { sourceId: 1, value: 1_050_000, currency: "PLN", recordedAt: "2026-11-05T10:00:00Z" },
      { sourceId: 1, value: 1_108_800, currency: "PLN", recordedAt: "2026-11-20T10:00:00Z" },
    ]);
    const result = netWorthChart({
      history: h,
      deploymentMonth: "2026-11",
      now: new Date("2026-12-15T12:00:00Z"),
      rateForDay: ratesFrom({ "2026-11-30": 42_500 }),
      currentRate: 43_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const nov = result.points.find((p) => p.month === "2026-11");
    // 1 108 800 (PLN) + 100 000 € × 4,2500 = 425 000 → 1 533 800 = 15 338,00 zł.
    expect(nov).toEqual({ month: "2026-11", pln: 1_533_800, change: null });
  });

  it("zmiany w grudniu nie ruszają punktu listopadowego (SPEC 5.11)", () => {
    const base: RawEntry[] = [
      { sourceId: 1, value: 1_108_800, currency: "PLN", recordedAt: "2026-11-20T10:00:00Z" },
      { sourceId: 2, value: 100_000, currency: "EUR", recordedAt: "2026-11-01T09:00:00Z" },
    ];
    const withDecember = history([
      ...base,
      { sourceId: 1, value: 2_000_000, currency: "PLN", recordedAt: "2026-12-10T10:00:00Z" },
    ]);
    const result = netWorthChart({
      history: withDecember,
      deploymentMonth: "2026-11",
      now: new Date("2026-12-15T12:00:00Z"),
      // Inny (bieżący) kurs niż listopadowy — i tak nie dotyka listopada.
      rateForDay: ratesFrom({ "2026-11-30": 42_500 }),
      currentRate: 50_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((p) => p.month)).toEqual(["2026-11", "2026-12"]);
    expect(result.points[0].pln).toBe(1_533_800);
    // Grudzień (bieżący): 2 000 000 + 100 000 € × 5,0000 = 500 000 → 2 500 000.
    expect(result.points[1].pln).toBe(2_500_000);
    expect(result.points[1].change).toBe(2_500_000 - 1_533_800);
  });

  it("jeden punkt w miesiącu wdrożenia (SPEC 5.11, scen. 26)", () => {
    const h = history([
      { sourceId: 1, value: 500_000, currency: "PLN", recordedAt: "2026-11-02T09:00:00Z" },
    ]);
    const result = netWorthChart({
      history: h,
      deploymentMonth: "2026-11",
      now: new Date("2026-11-20T12:00:00Z"),
      rateForDay: ratesFrom({}),
      currentRate: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toEqual([
      { month: "2026-11", pln: 500_000, change: null },
    ]);
  });

  it("źródło dodane w trakcie miesiąca nie liczy się do wcześniejszego punktu", () => {
    const h = history([
      { sourceId: 1, value: 300_000, currency: "PLN", recordedAt: "2026-11-02T09:00:00Z" },
      { sourceId: 2, value: 200_000, currency: "PLN", recordedAt: "2026-12-10T09:00:00Z" },
    ]);
    const result = netWorthChart({
      history: h,
      deploymentMonth: "2026-11",
      now: new Date("2026-12-20T12:00:00Z"),
      rateForDay: ratesFrom({}),
      currentRate: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0].pln).toBe(300_000); // listopad: tylko źródło 1
    expect(result.points[1].pln).toBe(500_000); // grudzień: oba
  });

  it("zarchiwizowane źródło przestaje się liczyć od wartości 0", () => {
    const h = history([
      { sourceId: 1, value: 400_000, currency: "PLN", recordedAt: "2026-11-02T09:00:00Z" },
      { sourceId: 1, value: 0, currency: "PLN", recordedAt: "2026-12-05T09:00:00Z" },
    ]);
    const result = netWorthChart({
      history: h,
      deploymentMonth: "2026-11",
      now: new Date("2026-12-20T12:00:00Z"),
      rateForDay: ratesFrom({}),
      currentRate: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0].pln).toBe(400_000); // listopad: jeszcze aktywne
    expect(result.points[1].pln).toBe(0); // grudzień: zarchiwizowane (0)
  });

  it("zmiana waluty źródła bierze walutę zapisaną z danym punktem", () => {
    const h = history([
      // Najpierw PLN, w grudniu przepięte na EUR tą samą liczbą (SPEC 7).
      { sourceId: 1, value: 100_000, currency: "PLN", recordedAt: "2026-11-02T09:00:00Z" },
      { sourceId: 1, value: 100_000, currency: "EUR", recordedAt: "2026-12-05T09:00:00Z" },
    ]);
    const result = netWorthChart({
      history: h,
      deploymentMonth: "2026-11",
      now: new Date("2026-12-20T12:00:00Z"),
      rateForDay: ratesFrom({ "2026-11-30": 42_500 }),
      currentRate: 43_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0].pln).toBe(100_000); // listopad: 1 000,00 zł
    // Grudzień: 100 000 € × 4,3000 = 430 000.
    expect(result.points[1].pln).toBe(430_000);
  });

  it("przełom roku: grudzień 2026 → styczeń 2027", () => {
    const h = history([
      { sourceId: 1, value: 100_000, currency: "PLN", recordedAt: "2026-12-10T09:00:00Z" },
      { sourceId: 1, value: 150_000, currency: "PLN", recordedAt: "2027-01-10T09:00:00Z" },
    ]);
    const result = netWorthChart({
      history: h,
      deploymentMonth: "2026-12",
      now: new Date("2027-01-20T12:00:00Z"),
      rateForDay: ratesFrom({}),
      currentRate: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((p) => p.month)).toEqual(["2026-12", "2027-01"]);
    expect(result.points[0].pln).toBe(100_000);
    expect(result.points[1].pln).toBe(150_000);
  });

  it("brak kursu z końca miesiąca dla źródła EUR → cały wykres prosi o kurs", () => {
    const h = history([
      { sourceId: 1, value: 50_000, currency: "EUR", recordedAt: "2026-11-02T09:00:00Z" },
    ]);
    const result = netWorthChart({
      history: h,
      deploymentMonth: "2026-11",
      now: new Date("2026-12-20T12:00:00Z"),
      rateForDay: ratesFrom({}), // brak tabeli i brak kursu zapasowego
      currentRate: null,
    });
    expect(result).toEqual({ ok: false, reason: "brak-kursu" });
  });

  it("zerowe źródło EUR bez kursu nie blokuje wykresu", () => {
    const h = history([
      { sourceId: 1, value: 200_000, currency: "PLN", recordedAt: "2026-11-02T09:00:00Z" },
      { sourceId: 2, value: 0, currency: "EUR", recordedAt: "2026-11-02T09:00:00Z" },
    ]);
    const result = netWorthChart({
      history: h,
      deploymentMonth: "2026-11",
      now: new Date("2026-12-20T12:00:00Z"),
      rateForDay: ratesFrom({}),
      currentRate: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0].pln).toBe(200_000);
  });
});

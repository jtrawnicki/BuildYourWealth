import { describe, expect, it } from "vitest";
import {
  currentRate,
  rateOnDay,
  rateOnDayOrFallback,
  settlementRate,
  type NbpRate,
} from "./select";

const nbp = (effectiveDate: string, rate: number): NbpRate => ({
  effectiveDate,
  rate,
});

describe("kurs rozliczenia (reguła 6.10)", () => {
  it("weekend na końcu miesiąca: 31.10.2026 to sobota → tabela z 30.10", () => {
    const rates = [nbp("2026-10-29", 42600), nbp("2026-10-30", 42650)];
    expect(settlementRate(rates, "2026-10", 43000)).toEqual({
      source: "nbp",
      rate: 42650,
      date: "2026-10-30",
    });
  });

  it("tabela z następnego miesiąca nie jest kursem rozliczenia (scen. 23)", () => {
    const rates = [nbp("2026-10-30", 42650), nbp("2026-11-04", 43000)];
    expect(settlementRate(rates, "2026-10", null)).toEqual({
      source: "nbp",
      rate: 42650,
      date: "2026-10-30",
    });
  });

  it("rozliczenie w dniu D przed publikacją tabeli bierze poprzednią (scen. 35)", () => {
    const before = [nbp("2026-11-26", 42700), nbp("2026-11-27", 42600)];
    expect(settlementRate(before, "2026-11", null)).toEqual({
      source: "nbp",
      rate: 42600,
      date: "2026-11-27",
    });

    const after = [...before, nbp("2026-11-30", 42500)];
    expect(settlementRate(after, "2026-11", null)).toEqual({
      source: "nbp",
      rate: 42500,
      date: "2026-11-30",
    });
  });

  it("okno D − 6 … D: tabela z D − 6 się liczy, z D − 7 już nie", () => {
    expect(settlementRate([nbp("2026-10-25", 42400)], "2026-10", null)).toEqual(
      { source: "nbp", rate: 42400, date: "2026-10-25" },
    );
    expect(
      settlementRate([nbp("2026-10-24", 42400)], "2026-10", 43000),
    ).toEqual({ source: "fallback", rate: 43000 });
  });

  it("brak tabel w oknie → kurs zapasowy (scen. 24)", () => {
    expect(settlementRate([], "2026-10", 43000)).toEqual({
      source: "fallback",
      rate: 43000,
    });
  });

  it("brak tabel i kursu zapasowego → brak kursu", () => {
    expect(settlementRate([nbp("2026-10-01", 42000)], "2026-10", null)).toBe(
      null,
    );
  });
});

describe("kurs na dzień i bieżący kurs (reguła 6.10)", () => {
  const rates = [nbp("2026-10-30", 42650), nbp("2026-11-04", 43000)];

  it("kurs na dzień to ostatnia tabela z datą ≤ D", () => {
    expect(rateOnDay(rates, "2026-10-31")).toEqual({
      source: "nbp",
      rate: 42650,
      date: "2026-10-30",
    });
    expect(rateOnDay(rates, "2026-11-04")?.rate).toBe(43000);
    expect(rateOnDay(rates, "2026-10-29")).toBeNull();
    expect(rateOnDayOrFallback(rates, "2026-10-29", 42000)).toEqual({
      source: "fallback",
      rate: 42000,
    });
  });

  it("bieżący kurs to kurs na dziś w strefie Europe/Warsaw", () => {
    // 3.11 23:30 UTC to już 4.11 w Warszawie.
    expect(currentRate(rates, null, new Date("2026-11-03T23:30:00Z"))).toEqual({
      source: "nbp",
      rate: 43000,
      date: "2026-11-04",
    });
    expect(
      currentRate(rates, null, new Date("2026-11-03T22:30:00Z"))?.rate,
    ).toBe(42650);
  });

  it("bez tabel bieżący kurs to kurs zapasowy, a bez niego brak kursu", () => {
    const now = new Date("2026-11-05T10:00:00Z");
    expect(currentRate([], 43000, now)).toEqual({
      source: "fallback",
      rate: 43000,
    });
    expect(currentRate([], null, now)).toBeNull();
  });
});

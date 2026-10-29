import { describe, expect, it } from "vitest";
import {
  chosenRateText,
  currentRateText,
  isCurrentRateStale,
  settledRateText,
} from "./label";

// Między liczbą a „zł" jest twarda spacja (NBSP), jak w `formatMoney`.
const S = " ";

describe("etykieta bieżącego kursu (Ustawienia)", () => {
  it("NBP z datą tabeli (scen. 22)", () => {
    expect(
      currentRateText({ source: "nbp", rate: 42731, date: "2026-10-27" }),
    ).toBe(`4,2731${S}zł · NBP, tabela z 27.10.2026`);
  });

  it("kurs zapasowy", () => {
    expect(currentRateText({ source: "fallback", rate: 43000 })).toBe(
      `4,3000${S}zł · kurs zapasowy`,
    );
  });
});

describe("etykieta kursu rozliczenia (Historia, rozliczenie)", () => {
  it("NBP z datą (scen. 23)", () => {
    expect(settledRateText(42650, "nbp", "2026-10-30")).toBe(
      `4,2650${S}zł (NBP, 30.10.2026)`,
    );
  });

  it("kurs zapasowy (scen. 24)", () => {
    expect(settledRateText(43000, "fallback", null)).toBe(
      `4,3000${S}zł · kurs zapasowy`,
    );
  });

  it("ręczny sprzed Etapu 2 (scen. 39)", () => {
    expect(settledRateText(43000, "manual", null)).toBe(
      `4,3000${S}zł (ręczny, sprzed Etapu 2)`,
    );
  });

  it("z wybranego kursu na ekranie rozliczenia", () => {
    expect(
      chosenRateText({ source: "nbp", rate: 42650, date: "2026-10-30" }),
    ).toBe(`4,2650${S}zł (NBP, 30.10.2026)`);
    expect(chosenRateText({ source: "fallback", rate: 43000 })).toBe(
      `4,3000${S}zł · kurs zapasowy`,
    );
  });
});

describe("czy kurs jest stary (ostrzeżenie w Ustawieniach)", () => {
  const now = new Date("2026-10-29T10:00:00+02:00");

  it("tabela NBP w ostatnich 7 dniach nie jest stara", () => {
    expect(
      isCurrentRateStale(
        { source: "nbp", rate: 42731, date: "2026-10-27" },
        now,
      ),
    ).toBe(false);
    // Dokładnie 7 dni wstecz to jeszcze nie „starszy niż 7 dni".
    expect(
      isCurrentRateStale(
        { source: "nbp", rate: 42731, date: "2026-10-22" },
        now,
      ),
    ).toBe(false);
  });

  it("tabela NBP starsza niż 7 dni jest stara", () => {
    expect(
      isCurrentRateStale(
        { source: "nbp", rate: 42731, date: "2026-10-21" },
        now,
      ),
    ).toBe(true);
  });

  it("kurs zapasowy jest zawsze oznaczony jako stary", () => {
    expect(isCurrentRateStale({ source: "fallback", rate: 43000 }, now)).toBe(
      true,
    );
  });
});

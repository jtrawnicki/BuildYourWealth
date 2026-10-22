import { describe, expect, it } from "vitest";
import { plannedActual } from "./settlement";

describe("plannedActual (SPEC 5.5, 6.8)", () => {
  it("zwraca kwotę planu bez zmian dla celu PLN", () => {
    expect(plannedActual(96500, "PLN", null)).toBe(96500);
    // Kurs jest ignorowany dla PLN.
    expect(plannedActual(96500, "PLN", 43000)).toBe(96500);
  });

  it("przelicza plan EUR po kursie, połówki w górę (scen. 6)", () => {
    // 220,50 zł po kursie 4,3000 to 51,279… € → 51,28 €.
    expect(plannedActual(22050, "EUR", 43000)).toBe(5128);
  });

  it("odmawia celu EUR bez kursu", () => {
    expect(() => plannedActual(22050, "EUR", null)).toThrow(RangeError);
  });
});

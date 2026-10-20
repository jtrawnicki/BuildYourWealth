import { describe, expect, it } from "vitest";
import { goalProgress, isGoalReached } from "./progress";

describe("postęp celu (SPEC 6.6)", () => {
  it("scenariusz 11: kwota startowa 2 000 zł i wpłaty 588 + 512 zł → 3 100 zł", () => {
    expect(goalProgress(200_000, [58_800, 51_200])).toBe(310_000);
  });

  it("scenariusz 17: cel EUR, start 500 € i wpłata 51,28 € → 551,28 €", () => {
    expect(goalProgress(50_000, [5128])).toBe(55_128);
  });

  it("puste pole kwoty startowej liczy się jak 0", () => {
    expect(goalProgress(null, [10_000, 20_000])).toBe(30_000);
  });

  it("bez rozliczonych wpłat postęp to sama kwota startowa", () => {
    expect(goalProgress(200_000, [])).toBe(200_000);
  });
});

describe("cel osiągnięty (SPEC 5.3)", () => {
  it("scenariusz 10: po osiągnięciu kwoty docelowej 5 000 zł cel jest osiągnięty", () => {
    expect(isGoalReached(500_000, 500_000)).toBe(true);
    expect(isGoalReached(520_000, 500_000)).toBe(true);
  });

  it("postęp poniżej kwoty docelowej nie jest osiągnięty", () => {
    expect(isGoalReached(310_000, 500_000)).toBe(false);
  });

  it("cel bez kwoty docelowej nigdy nie jest osiągnięty", () => {
    expect(isGoalReached(999_999, null)).toBe(false);
  });

  it("kwota docelowa 0 oznacza cel osiągnięty od razu", () => {
    expect(isGoalReached(0, 0)).toBe(true);
  });
});

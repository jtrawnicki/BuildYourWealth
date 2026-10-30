import { describe, expect, it } from "vitest";
import {
  ceilMulDiv,
  floorMulDiv,
  roundMulDivHalfAwayFromZero,
  roundMulDivHalfUp,
  toSafeInteger,
} from "./arithmetic";

describe("toSafeInteger", () => {
  it("przepuszcza wartości w bezpiecznym zakresie", () => {
    expect(toSafeInteger(BigInt(0))).toBe(0);
    expect(toSafeInteger(BigInt(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(toSafeInteger(BigInt(-Number.MAX_SAFE_INTEGER))).toBe(
      -Number.MAX_SAFE_INTEGER,
    );
  });

  it("zgłasza błąd dla wartości poza zakresem", () => {
    expect(() =>
      toSafeInteger(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)),
    ).toThrow(RangeError);
    expect(() =>
      toSafeInteger(-(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1))),
    ).toThrow(RangeError);
  });
});

describe("floorMulDiv", () => {
  it("zaokrągla w dół", () => {
    expect(floorMulDiv(144_750, 2500, 10_000)).toBe(36_187); // 36 187,5 → 36 187
    expect(floorMulDiv(980_000, 2000, 10_000)).toBe(196_000);
  });

  it("liczy dokładnie, gdy iloczyn pośredni przekracza MAX_SAFE_INTEGER", () => {
    // 200 000 000 000 × 45 036 = 9,0072e15 > MAX_SAFE_INTEGER (ok. 9,0072e15).
    expect(floorMulDiv(200_000_000_000, 45_036, 10_000)).toBe(900_720_000_000);
  });

  it("zgłasza błąd, gdy sam wynik jest poza bezpiecznym zakresem", () => {
    expect(() => floorMulDiv(Number.MAX_SAFE_INTEGER, 10_001, 10_000)).toThrow(
      RangeError,
    );
  });
});

describe("roundMulDivHalfUp", () => {
  it("zaokrągla do najbliższej liczby, połówki w górę", () => {
    expect(roundMulDivHalfUp(22_050, 10_000, 43_000)).toBe(5128); // 5127,9… → 5128
    expect(roundMulDivHalfUp(1, 10_000, 20_000)).toBe(1); // 0,5 → 1
    expect(roundMulDivHalfUp(3, 10_000, 20_000)).toBe(2); // 1,5 → 2
  });

  it("liczy dokładnie przy iloczynie pośrednim powyżej MAX_SAFE_INTEGER", () => {
    expect(roundMulDivHalfUp(200_000_000_000, 45_036, 10_000)).toBe(
      900_720_000_000,
    );
  });
});

describe("ceilMulDiv", () => {
  it("zaokrągla w górę, a wynik dokładny zostawia", () => {
    expect(ceilMulDiv(130_000, 1, 56_666)).toBe(3); // 2,29… → 3 (liczba wpłat)
    expect(ceilMulDiv(300_000, 1, 7)).toBe(42_858); // 428,57… → 428,58
    expect(ceilMulDiv(71_200, 10_000, 196_000)).toBe(3_633); // 36,32…% → 36,33%
    expect(ceilMulDiv(71_200, 1, 4)).toBe(17_800); // dzieli się równo
  });

  it("liczy dokładnie przy iloczynie pośrednim powyżej MAX_SAFE_INTEGER", () => {
    expect(ceilMulDiv(200_000_000_000, 10_000, 196_000)).toBe(10_204_081_633);
  });
});

describe("roundMulDivHalfAwayFromZero", () => {
  it("dla wartości nieujemnych działa jak zaokrąglenie połówek w górę", () => {
    expect(roundMulDivHalfAwayFromZero(1, 1, 2)).toBe(1); // 0,5 → 1
    expect(roundMulDivHalfAwayFromZero(3, 1, 2)).toBe(2); // 1,5 → 2
    expect(roundMulDivHalfAwayFromZero(1_000_000, 600, 120_000)).toBe(5000);
  });

  it("połówki ujemne zaokrągla od zera", () => {
    expect(roundMulDivHalfAwayFromZero(-1, 1, 2)).toBe(-1); // −0,5 → −1
    expect(roundMulDivHalfAwayFromZero(-3, 1, 2)).toBe(-2); // −1,5 → −2
    expect(roundMulDivHalfAwayFromZero(-16_578_5, 1, 10)).toBe(-16_579); // −16 578,5 → −16 579
  });

  it("zysk miesiąca przy ujemnej stopie (reguła 6.14)", () => {
    // wartość 1 000 000 gr × −10,00% ÷ 12 ÷ 10 000 = −833,33… → −8333 gr (od zera)
    expect(roundMulDivHalfAwayFromZero(1_000_000, -1000, 120_000)).toBe(-8333);
  });

  it("liczy dokładnie przy iloczynie pośrednim powyżej MAX_SAFE_INTEGER", () => {
    expect(roundMulDivHalfAwayFromZero(-200_000_000_000, 45_036, 10_000)).toBe(
      -900_720_000_000,
    );
  });
});

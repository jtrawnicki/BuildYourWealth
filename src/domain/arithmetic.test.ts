import { describe, expect, it } from "vitest";
import { floorMulDiv, roundMulDivHalfUp, toSafeInteger } from "./arithmetic";

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

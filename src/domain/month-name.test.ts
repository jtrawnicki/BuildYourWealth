import { describe, expect, it } from "vitest";
import { formatMonthShort, formatMonthTitle, monthGenitive } from "./month-name";

describe("formatMonthTitle", () => {
  it("daje nazwę miesiąca z wielkiej litery i rok", () => {
    expect(formatMonthTitle("2026-10")).toBe("Październik 2026");
    expect(formatMonthTitle("2026-01")).toBe("Styczeń 2026");
    expect(formatMonthTitle("2025-12")).toBe("Grudzień 2025");
  });
});

describe("monthGenitive", () => {
  it("daje dopełniacz nazwy miesiąca do zdania zachęty", () => {
    expect(monthGenitive("2026-10")).toBe("października");
    expect(monthGenitive("2026-09")).toBe("września");
    expect(monthGenitive("2026-01")).toBe("stycznia");
  });
});

describe("formatMonthShort (oś X wykresu, SPEC 8.1)", () => {
  it("daje trzyliterowy skrót, a styczeń z rokiem", () => {
    expect(formatMonthShort("2026-11")).toBe("lis");
    expect(formatMonthShort("2026-10")).toBe("paź");
    expect(formatMonthShort("2027-01")).toBe("sty 2027");
    expect(formatMonthShort("2026-12")).toBe("gru");
  });
});

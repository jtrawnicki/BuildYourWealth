import { describe, expect, it } from "vitest";
import { formatMonthTitle, monthGenitive } from "./month-name";

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

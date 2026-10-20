import { describe, expect, it } from "vitest";
import {
  canCreateMonth,
  canSettleMonth,
  currentMonth,
  daysInMonth,
  previousMonth,
} from "./time";

describe("currentMonth w strefie Europe/Warsaw (SPEC 5.4)", () => {
  it("granica 31.10 23:59 i 1.11 00:00 czasu warszawskiego", () => {
    // Październik 2026 po końcu czasu letniego (CET, UTC+1).
    expect(currentMonth(new Date("2026-10-31T22:59:00Z"))).toBe("2026-10");
    expect(currentMonth(new Date("2026-10-31T23:00:00Z"))).toBe("2026-11");
  });

  it("granica miesiąca mimo czasu letniego (marzec/kwiecień, CEST, UTC+2)", () => {
    expect(currentMonth(new Date("2026-03-31T21:59:00Z"))).toBe("2026-03");
    expect(currentMonth(new Date("2026-03-31T22:00:00Z"))).toBe("2026-04");
  });

  it("stabilny w chwili zmiany czasu letniego na zimowy", () => {
    // Noc z 24 na 25 października 2026, cofnięcie zegara o 02:00 warszawskiego.
    expect(currentMonth(new Date("2026-10-25T00:30:00Z"))).toBe("2026-10");
    expect(currentMonth(new Date("2026-10-25T01:30:00Z"))).toBe("2026-10");
  });

  it("granica grudzień → styczeń przechodzi przez rok", () => {
    expect(currentMonth(new Date("2026-12-31T22:59:00Z"))).toBe("2026-12");
    expect(currentMonth(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01");
  });
});

describe("previousMonth", () => {
  it.each([
    ["2026-10", "2026-09"],
    ["2026-01", "2025-12"],
    ["2027-01", "2026-12"],
  ])("poprzedni przed %s to %s", (key, expected) => {
    expect(previousMonth(key)).toBe(expected);
  });
});

describe("daysInMonth", () => {
  it.each([
    ["2026-02", 28],
    ["2024-02", 29], // rok przestępny
    ["2026-04", 30],
    ["2026-10", 31],
    ["2025-12", 31],
  ])("%s ma %i dni", (key, expected) => {
    expect(daysInMonth(key)).toBe(expected);
  });
});

describe("canSettleMonth (SPEC 5.5)", () => {
  it("bieżący miesiąc można rozliczyć dopiero od ostatniego dnia", () => {
    expect(canSettleMonth("2026-10", new Date("2026-10-15T12:00:00Z"))).toBe(
      false,
    );
    expect(canSettleMonth("2026-10", new Date("2026-10-30T22:59:00Z"))).toBe(
      false,
    );
    // 31.10 23:59 warszawskiego — ostatni dzień października.
    expect(canSettleMonth("2026-10", new Date("2026-10-31T22:59:00Z"))).toBe(
      true,
    );
  });

  it("miesiąc z przeszłości zawsze, przyszły nigdy", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(canSettleMonth("2026-09", now)).toBe(true);
    expect(canSettleMonth("2026-11", now)).toBe(false);
  });
});

describe("canCreateMonth (SPEC 5.4, scenariusz 18)", () => {
  it("wolno utworzyć bieżący i bezpośrednio poprzedni miesiąc", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(canCreateMonth("2026-10", now)).toBe(true);
    expect(canCreateMonth("2026-09", now)).toBe(true);
  });

  it("starszych ani przyszłych miesięcy tworzyć nie wolno", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(canCreateMonth("2026-08", now)).toBe(false);
    expect(canCreateMonth("2026-11", now)).toBe(false);
  });

  it("poprzedni miesiąc działa przez granicę roku", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(canCreateMonth("2025-12", now)).toBe(true);
    expect(canCreateMonth("2025-11", now)).toBe(false);
  });
});

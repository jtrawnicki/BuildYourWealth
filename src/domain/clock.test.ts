import { afterEach, describe, expect, it, vi } from "vitest";
import { clockOverride, now } from "./clock";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("podmiana zegara (STACK 5)", () => {
  it("bez flagi zwraca czas systemowy", () => {
    vi.stubEnv("E2E_NOW", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T08:00:00Z"));

    expect(clockOverride()).toBeNull();
    expect(now()).toEqual(new Date("2026-10-15T08:00:00Z"));
  });

  it("jawna flaga testowa podmienia bieżący moment", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("E2E_NOW", "2026-10-31T22:59:00Z");

    expect(now()).toEqual(new Date("2026-10-31T22:59:00Z"));
  });

  it("przy ustawionym VERCEL_ENV flaga jest ignorowana", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("E2E_NOW", "2026-10-31T22:59:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T08:00:00Z"));

    expect(clockOverride()).toBeNull();
    expect(now()).toEqual(new Date("2026-10-15T08:00:00Z"));
  });

  it("niepoprawna wartość flagi jest ignorowana", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("E2E_NOW", "nie-data");

    expect(clockOverride()).toBeNull();
  });
});

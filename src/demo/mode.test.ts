import { describe, expect, it } from "vitest";
import { resolveAppMode } from "./mode";

describe("tryb aplikacji (STACK 5)", () => {
  it("domyślnie wersja prywatna", () => {
    expect(resolveAppMode({})).toBe("private");
    expect(resolveAppMode({ APP_MODE: "" })).toBe("private");
  });

  it("przyjmuje jawny tryb", () => {
    expect(resolveAppMode({ APP_MODE: "private" })).toBe("private");
    expect(resolveAppMode({ APP_MODE: "demo" })).toBe("demo");
  });

  it("odrzuca nieznany tryb", () => {
    expect(() => resolveAppMode({ APP_MODE: "Demo" })).toThrow(/Nieznany tryb/);
  });

  it("na Vercel wymaga trybu demo", () => {
    for (const vercelEnv of ["production", "preview", "development"]) {
      expect(() => resolveAppMode({ VERCEL_ENV: vercelEnv })).toThrow(
        /APP_MODE=demo/,
      );
      expect(() =>
        resolveAppMode({ VERCEL_ENV: vercelEnv, APP_MODE: "private" }),
      ).toThrow(/APP_MODE=demo/);
      expect(resolveAppMode({ VERCEL_ENV: vercelEnv, APP_MODE: "demo" })).toBe(
        "demo",
      );
    }
  });
});

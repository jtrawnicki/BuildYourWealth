import { describe, expect, it } from "vitest";
import { activeTab } from "./nav";

describe("activeTab", () => {
  it("strona główna to Ten miesiąc", () => {
    expect(activeTab("/")).toBe("/");
  });

  it("zakładka i jej podstrony", () => {
    expect(activeTab("/majatek")).toBe("/majatek");
    expect(activeTab("/historia/2026-09")).toBe("/historia");
    expect(activeTab("/prognoza")).toBe("/prognoza");
    expect(activeTab("/ustawienia")).toBe("/ustawienia");
  });

  it("ścieżka o wspólnym początku nie jest podstroną", () => {
    expect(activeTab("/planik")).toBe("/");
  });
});

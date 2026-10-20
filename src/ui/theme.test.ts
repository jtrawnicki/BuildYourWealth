import { describe, expect, it } from "vitest";
import { THEME_SCRIPT, themeFromCookies } from "./theme";

describe("themeFromCookies", () => {
  it("odczytuje jasny i ciemny wśród innych ciasteczek", () => {
    expect(themeFromCookies("theme=light")).toBe("light");
    expect(themeFromCookies("a=1; theme=dark; b=2")).toBe("dark");
  });

  it("brak lub nieznana wartość oznacza motyw systemowy", () => {
    expect(themeFromCookies("")).toBeUndefined();
    expect(themeFromCookies("theme=system")).toBeUndefined();
    expect(themeFromCookies("theme=darker")).toBeUndefined();
    expect(themeFromCookies("mytheme=dark")).toBeUndefined();
  });
});

describe("THEME_SCRIPT", () => {
  function run(cookie: string) {
    const root = { dataset: {} as Record<string, string> };
    new Function("document", THEME_SCRIPT)({
      cookie,
      documentElement: root,
    });
    return root.dataset.theme;
  }

  it("daje ten sam wynik co themeFromCookies", () => {
    for (const cookie of [
      "",
      "theme=light",
      "a=1; theme=dark; b=2",
      "a=1;theme=dark",
      "theme=system",
      "theme=darker",
      "mytheme=dark",
    ]) {
      expect(run(cookie)).toBe(themeFromCookies(cookie));
    }
  });
});

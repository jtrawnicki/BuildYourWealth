import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

const tokens = new Map<string, [light: string, dark: string]>();
for (const m of css.matchAll(
  /--([\w-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/g,
)) {
  tokens.set(m[1], [m[2], m[3]]);
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Pary tekst/tło używane w makietach wariantu B.
const pairs: [text: string, background: string][] = [
  ["text", "bg"],
  ["text", "surface"],
  ["muted", "bg"],
  ["muted", "surface"],
  ["accent", "bg"],
  ["accent", "surface"],
  ["on-accent", "accent"], // przycisk główny formularza
  ["bg", "text"], // aktywna zakładka
  ["muted", "track"], // nieaktywna opcja przełącznika w Ustawieniach
  ["err-text", "surface"], // błąd pola formularza
  ["ok-text", "surface"], // potwierdzenie zapisu
  ["on-save", "save"],
  ["on-invest", "invest"],
  ["text", "spend"],
  ["save-ink", "save-soft"],
  ["invest-ink", "invest-soft"],
  ["warn-text", "warn-bg"],
  ["info-text", "info-bg"],
  ["ok-text", "ok-bg"],
  ["err-text", "err-bg"],
  ["disabled-text", "disabled-bg"],
  ["on-dark", "dark"],
  ["dark", "on-dark"], // przycisk na ciemnym pasku
];

describe("tokeny kolorów", () => {
  it("każdy token ma wartość dla obu motywów", () => {
    const declared = css.match(/^\s*--[\w-]+:/gm) ?? [];
    expect(tokens.size).toBe(declared.length);
  });

  for (const [mode, index] of [
    ["jasny", 0],
    ["ciemny", 1],
  ] as const) {
    it.each(pairs)(`motyw ${mode}: %s na %s ma kontrast ≥ 4.5:1`, (fg, bg) => {
      const a = tokens.get(fg)?.[index];
      const b = tokens.get(bg)?.[index];
      expect(a && b, `brak tokenu ${fg} lub ${bg}`).toBeTruthy();
      expect(contrast(a!, b!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

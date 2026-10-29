// Przygotowanie danych wykresu majątku do rysowania (SPEC 8.1): skala osi Y
// od 0 z okrągłym maksimum i skrócone etykiety kwot. Czyste funkcje liczone na
// groszach; komponent SVG dostaje gotowe liczby i napisy.

import type { ChartPoint } from "@/domain/networth-chart";
import { formatMoney, groupThousands, NBSP } from "@/domain/format";
import { formatMonthShort, formatMonthTitle } from "@/domain/month-name";
import type { ChartPointView } from "./NetWorthChart";

/** Liczba linii pomocniczych nad osią 0 (SPEC 8.1); z osią 0 daje 4 etykiety. */
const GRID_LINES = 3;

/** Najmniejszy „okrągły" krok ≥ `raw` z ciągu 1, 1,5, 2, 2,5, 3, 4, 5, 6, 8 ×10ⁿ (grosze). */
function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const mult of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
    const step = Math.round(mult * pow);
    if (step >= raw) return step;
  }
  return 10 * pow;
}

/** Górna linia osi Y: najmniejsze okrągłe maksimum podzielne na 3 równe kroki. */
export function niceMax(maxPln: number): number {
  const safe = maxPln > 0 ? maxPln : 1;
  return niceStep(Math.ceil(safe / GRID_LINES)) * GRID_LINES;
}

/**
 * Kwota skrócona na oś Y (SPEC 8.1): `5_000_000` → `50 tys. zł`,
 * `120_000_000` → `1,2 mln zł`, `0` → `0`. Zaokrąglenia są przybliżeniem
 * etykiety osi, nie kwotą do obliczeń.
 */
export function formatAmountShort(minor: number): string {
  if (minor === 0) return "0";
  if (minor >= 100_000_000) {
    const tenths = Math.round(minor / 10_000_000);
    const whole = Math.floor(tenths / 10);
    const frac = tenths % 10;
    return `${groupThousands(String(whole))}${frac ? `,${frac}` : ""}${NBSP}mln${NBSP}zł`;
  }
  if (minor >= 100_000) {
    const tenths = Math.round(minor / 10_000);
    const whole = Math.floor(tenths / 10);
    const frac = tenths % 10;
    return `${groupThousands(String(whole))}${frac ? `,${frac}` : ""}${NBSP}tys.${NBSP}zł`;
  }
  return `${groupThousands(String(Math.round(minor / 100)))}${NBSP}zł`;
}

/** Zmiana w dymku ze znakiem: `+1 120,00 zł` albo `−1 120,00 zł`. */
function formatChange(change: number | null): string | null {
  if (change === null) return null;
  const sign = change >= 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(change), "PLN")}`;
}

export type ChartView = {
  points: ChartPointView[];
  /** Etykiety osi Y od góry (yMax) do 0. */
  yLabels: string[];
  yMax: number;
};

/** Zamienia punkty reguły 6.11 na dane gotowe do rysowania. */
export function buildChartView(points: ChartPoint[]): ChartView {
  const max = points.reduce((m, p) => Math.max(m, p.pln), 0);
  const yMax = niceMax(max);
  const yLabels = Array.from({ length: GRID_LINES + 1 }, (_, k) =>
    formatAmountShort((yMax * (GRID_LINES - k)) / GRID_LINES),
  );
  return {
    yMax,
    yLabels,
    points: points.map((p) => ({
      month: p.month,
      pln: p.pln,
      xLabel: formatMonthShort(p.month),
      title: formatMonthTitle(p.month),
      amount: formatMoney(p.pln, "PLN"),
      change: formatChange(p.change),
    })),
  };
}

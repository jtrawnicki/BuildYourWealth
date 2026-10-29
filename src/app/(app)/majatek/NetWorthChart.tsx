"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styles from "./NetWorthChart.module.css";

/** Punkt wykresu gotowy do rysowania: liczba do geometrii, reszta do dymka. */
export type ChartPointView = {
  month: string;
  /** Suma w groszach — do pozycji na osi Y. */
  pln: number;
  /** Skrót na oś X (SPEC 8.1): „lis", „sty 2027". */
  xLabel: string;
  /** Pełny tytuł w dymku: „Listopad 2026". */
  title: string;
  /** Kwota w dymku: „48 230,00 zł". */
  amount: string;
  /** Zmiana względem poprzedniego punktu albo `null` dla pierwszego. */
  change: string | null;
};

type Props = {
  points: ChartPointView[];
  /** Skrócone etykiety osi Y od góry do 0, np. ["60 tys. zł", …, "0"]. */
  yLabels: string[];
  /** Wartość górnej linii osi Y w groszach (0 u dołu). */
  yMax: number;
};

const PAD = { top: 16, right: 14, bottom: 26, left: 56 };

/** Co która etykieta osi X mieści się bez nakładania przy danej szerokości. */
function labelStep(count: number, plotWidth: number): number {
  const perLabel = 44;
  const fit = Math.max(1, Math.floor(plotWidth / perLabel));
  return Math.ceil(count / fit);
}

export function NetWorthChart({ points, yLabels, yMax }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = width <= 380 ? 160 : 200;
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = Math.max(1, height - PAD.top - PAD.bottom);

  const x = (i: number) =>
    points.length === 1
      ? PAD.left + plotW / 2
      : PAD.left + (plotW * i) / (points.length - 1);
  const y = (pln: number) => PAD.top + plotH * (1 - pln / yMax);

  const line = points.map((p, i) => `${x(i)},${y(p.pln)}`).join(" ");
  const step = labelStep(points.length, plotW);

  const pickNearest = useCallback(
    (clientX: number) => {
      const el = wrapRef.current;
      if (!el) return;
      const rel = clientX - el.getBoundingClientRect().left;
      const n = points.length;
      const pw = Math.max(1, width - PAD.left - PAD.right);
      const at = (i: number) =>
        n === 1 ? PAD.left + pw / 2 : PAD.left + (pw * i) / (n - 1);
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(at(i) - rel);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setActive(best);
    },
    [points.length, width],
  );

  // Escape zamyka dymek otwarty z klawiatury.
  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const activePoint = active === null ? null : points[active];

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <svg
        className={styles.svg}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-hidden="true"
        onPointerMove={(e) => pickNearest(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onPointerDown={(e) => pickNearest(e.clientX)}
      >
        {yLabels.map((label, k) => {
          const gy = PAD.top + (plotH * k) / (yLabels.length - 1);
          return (
            <g key={label + k}>
              <line
                className={styles.grid}
                x1={PAD.left}
                y1={gy}
                x2={width - PAD.right}
                y2={gy}
              />
              <text className={styles.yLabel} x={PAD.left - 8} y={gy + 4}>
                {label}
              </text>
            </g>
          );
        })}

        <polyline className={styles.line} points={line} />

        {points.map((p, i) => {
          const showLabel = (points.length - 1 - i) % step === 0;
          return (
            <g key={p.month}>
              {showLabel && (
                <text
                  className={styles.xLabel}
                  x={x(i)}
                  y={height - 8}
                  textAnchor="middle"
                >
                  {p.xLabel}
                </text>
              )}
              <circle
                className={i === active ? styles.dotActive : styles.dot}
                cx={x(i)}
                cy={y(p.pln)}
                r={i === active ? 5 : 3.5}
              />
              {/* Niewidoczny, szeroki cel fokusu dla klawiatury; dane dla
                  czytników ekranu są w tabeli niżej, więc tu aria-hidden. */}
              <circle
                className={styles.hit}
                cx={x(i)}
                cy={y(p.pln)}
                r={12}
                tabIndex={0}
                aria-hidden="true"
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>

      {activePoint && (
        <div
          className={styles.tooltip}
          style={{
            left: `${x(active as number)}px`,
            top: `${y(activePoint.pln)}px`,
          }}
          role="presentation"
        >
          <span className={styles.tipTitle}>{activePoint.title}</span>
          <span className={styles.tipAmount}>{activePoint.amount}</span>
          {activePoint.change && (
            <span className={styles.tipChange}>{activePoint.change}</span>
          )}
        </div>
      )}

      <table className={styles.srTable}>
        <caption>Wartość majątku na koniec miesiąca</caption>
        <thead>
          <tr>
            <th scope="col">Miesiąc</th>
            <th scope="col">Wartość majątku</th>
            <th scope="col">Zmiana</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <th scope="row">{p.title}</th>
              <td>{p.amount}</td>
              <td>{p.change ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

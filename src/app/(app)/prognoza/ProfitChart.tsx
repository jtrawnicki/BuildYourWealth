"use client";

import { useEffect, useRef, useState } from "react";
import { formatAmountShort, niceMax } from "@/app/(app)/majatek/chart-view";
import styles from "./ProfitChart.module.css";

type Props = {
  /** Indeks miesiąca końca horyzontu (= 12 × lata). */
  months: number;
  /** Majątek dziś w groszach (warstwa dolna, stała). */
  netWorthToday: number;
  /** Miesięczna wpłata scenariusza w groszach. */
  contribution: number;
  /** Majątek scenariusza w groszach, k = 0 … months. */
  total: number[];
  /** Czy rysować warstwę zysku (tylko przy zysku dodatnim, SPEC 5.13). */
  withProfit: boolean;
};

const PAD = { top: 16, right: 14, bottom: 26, left: 56 };
const GRID_LINES = 3;

export function ProfitChart({
  months,
  netWorthToday,
  contribution,
  total,
  withProfit,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = 240;
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = Math.max(1, height - PAD.top - PAD.bottom);

  let max = netWorthToday;
  for (let i = 0; i <= months; i += 1) max = Math.max(max, total[i]);
  const yMax = niceMax(max);

  const x = (i: number) => PAD.left + (plotW * i) / months;
  const y = (minor: number) => PAD.top + plotH * (1 - minor / yMax);

  // Granice warstw: majątek dziś, suma wpłat i majątek scenariusza; przy zysku
  // ujemnym warstwy są przycięte od góry do majątku (SPEC 5.13).
  const b1 = (i: number) => Math.min(netWorthToday, total[i]);
  const b2 = (i: number) =>
    Math.min(netWorthToday + i * contribution, total[i]);
  const b3 = (i: number) => total[i];

  const band = (lower: (i: number) => number, upper: (i: number) => number) => {
    const top: string[] = [];
    const bottom: string[] = [];
    for (let i = 0; i <= months; i += 1) {
      top.push(`${x(i)},${y(upper(i))}`);
      bottom.unshift(`${x(i)},${y(lower(i))}`);
    }
    return `${top.join(" ")} ${bottom.join(" ")}`;
  };

  const yLabels = Array.from({ length: GRID_LINES + 1 }, (_, k) =>
    formatAmountShort((yMax * (GRID_LINES - k)) / GRID_LINES),
  );

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <svg
        className={styles.svg}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Wykres warstwowy: majątek dziś, suma wpłat i zysk. Kwoty w legendzie obok."
      >
        <g aria-hidden="true">
          {yLabels.map((label, k) => {
            const gy = PAD.top + (plotH * k) / GRID_LINES;
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

          <polygon className={styles.today} points={band(() => 0, b1)} />
          <polygon className={styles.contrib} points={band(b1, b2)} />
          {withProfit && (
            <polygon className={styles.profit} points={band(b2, b3)} />
          )}
        </g>
      </svg>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatMonthYear } from "@/domain/month-name";
import { addMonths } from "@/domain/time";
import {
  SCENARIOS,
  type Milestone,
  type Scenario,
} from "@/domain/wealth-forecast";
import { formatAmountShort, niceMax } from "@/app/(app)/majatek/chart-view";
import {
  SCENARIO_NAME,
  formatMinorAsZloty,
  formatThresholdShort,
} from "./text";
import styles from "./ScenarioChart.module.css";

type Props = {
  currentMonth: string;
  /** Indeks miesiąca końca horyzontu (= 12 × lata). */
  months: number;
  scenarioNetWorth: Record<Scenario, number[]>;
  milestones: Milestone[];
};

const PAD = { top: 22, right: 48, bottom: 26, left: 56 };
const GRID_LINES = 3;

const LINE_CLASS: Record<Scenario, string> = {
  0: styles.lineBase,
  5: styles.line5,
  10: styles.line10,
  15: styles.line15,
};

export function ScenarioChart({
  currentMonth,
  months,
  scenarioNetWorth,
  milestones,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Horyzont bywa krótszy po zmianie, więc aktywny punkt przycinamy przy odczycie.
  const act = active === null ? null : Math.min(active, months);

  const height = width <= 380 ? 260 : 340;
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = Math.max(1, height - PAD.top - PAD.bottom);

  let max = 0;
  for (const scenario of SCENARIOS) {
    for (let i = 0; i <= months; i += 1) {
      max = Math.max(max, scenarioNetWorth[scenario][i]);
    }
  }
  const yMax = niceMax(max);

  const x = (i: number) => PAD.left + (plotW * i) / months;
  const y = (minor: number) => PAD.top + plotH * (1 - minor / yMax);

  const yLabels = Array.from({ length: GRID_LINES + 1 }, (_, k) =>
    formatAmountShort((yMax * (GRID_LINES - k)) / GRID_LINES),
  );

  // Etykiety lat na osi X; co ile lat, żeby się nie nakładały.
  const years = months / 12;
  const perLabel = 46;
  const fit = Math.max(1, Math.floor(plotW / perLabel));
  const yearStep = Math.ceil(years / fit);

  const pickNearest = useCallback(
    (clientX: number) => {
      const el = wrapRef.current;
      if (!el) return;
      const rel = clientX - el.getBoundingClientRect().left;
      const i = Math.round(((rel - PAD.left) / Math.max(1, plotW)) * months);
      setActive(Math.max(0, Math.min(months, i)));
    },
    [months, plotW],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    const step =
      event.key === "ArrowRight" ? 12 : event.key === "ArrowLeft" ? -12 : null;
    if (step !== null) {
      event.preventDefault();
      setActive((a) => {
        const base = a ?? months;
        return Math.max(0, Math.min(months, base + step));
      });
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(months);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  const activeMonth =
    act === null ? null : formatMonthYear(addMonths(currentMonth, act));

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <svg
        className={styles.svg}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        tabIndex={0}
        aria-label="Wykres majątku w czterech scenariuszach; strzałki przesuwają o rok"
        onPointerMove={(e) => pickNearest(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onPointerDown={(e) => pickNearest(e.clientX)}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? months)}
        onBlur={() => setActive(null)}
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

          {Array.from({ length: years }, (_, n) => n + 1)
            .filter((n) => n % yearStep === 0)
            .map((n) => (
              <text
                key={n}
                className={styles.xLabel}
                x={x(n * 12)}
                y={height - 8}
                textAnchor="middle"
              >
                {addMonths(currentMonth, n * 12).slice(0, 4)}
              </text>
            ))}

          {milestones.map((milestone) => {
            const reach = milestone.reached[0];
            if (!reach) return null;
            const mx = x(reach.k);
            const my = y(scenarioNetWorth[0][reach.k]);
            return (
              <g key={milestone.threshold}>
                <line
                  className={styles.milestoneLine}
                  x1={mx}
                  y1={PAD.top}
                  x2={mx}
                  y2={PAD.top + plotH}
                />
                <text
                  className={styles.milestoneLabel}
                  x={mx}
                  y={PAD.top - 8}
                  textAnchor="middle"
                >
                  {formatThresholdShort(milestone.threshold)}
                </text>
                <rect
                  className={styles.milestoneMark}
                  x={mx - 4}
                  y={my - 4}
                  width={8}
                  height={8}
                  transform={`rotate(45 ${mx} ${my})`}
                />
              </g>
            );
          })}

          {SCENARIOS.map((scenario) => {
            const line = Array.from(
              { length: months + 1 },
              (_, i) => `${x(i)},${y(scenarioNetWorth[scenario][i])}`,
            ).join(" ");
            return (
              <polyline
                key={scenario}
                className={`${styles.line} ${LINE_CLASS[scenario]}`}
                points={line}
              />
            );
          })}

          {SCENARIOS.map((scenario) => (
            <text
              key={scenario}
              className={styles.endLabel}
              x={x(months) + 4}
              y={y(scenarioNetWorth[scenario][months]) + 3}
            >
              {SCENARIO_NAME[scenario]}
            </text>
          ))}

          {act !== null && (
            <>
              <line
                className={styles.cursor}
                x1={x(act)}
                y1={PAD.top}
                x2={x(act)}
                y2={PAD.top + plotH}
              />
              {SCENARIOS.map((scenario) => (
                <circle
                  key={scenario}
                  className={`${styles.dot} ${LINE_CLASS[scenario]}`}
                  cx={x(act)}
                  cy={y(scenarioNetWorth[scenario][act])}
                  r={3.5}
                />
              ))}
            </>
          )}
        </g>
      </svg>

      {act !== null && activeMonth && (
        <div className={styles.tooltip} role="presentation">
          <span className={styles.tipTitle}>{activeMonth}</span>
          {SCENARIOS.map((scenario) => (
            <span key={scenario} className={styles.tipRow}>
              {SCENARIO_NAME[scenario]} ·{" "}
              {formatMinorAsZloty(scenarioNetWorth[scenario][act])}
            </span>
          ))}
        </div>
      )}

      <div className={styles.srTable}>
        <table>
          <caption>Majątek na koniec każdego roku horyzontu</caption>
          <thead>
            <tr>
              <th scope="col">Rok</th>
              {SCENARIOS.map((scenario) => (
                <th key={scenario} scope="col">
                  {SCENARIO_NAME[scenario]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: years }, (_, n) => n + 1).map((n) => (
              <tr key={n}>
                <th scope="row">
                  {formatMonthYear(addMonths(currentMonth, n * 12))}
                </th>
                {SCENARIOS.map((scenario) => (
                  <td key={scenario}>
                    {formatMinorAsZloty(scenarioNetWorth[scenario][n * 12])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

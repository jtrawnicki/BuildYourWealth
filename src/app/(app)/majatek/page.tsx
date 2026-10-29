import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import {
  listSourceHistory,
  listSources,
  type SourceRow,
} from "@/db/sources";
import { now } from "@/domain/clock";
import { convertEurToPln, netWorthPln } from "@/domain/currency";
import { formatAmount, formatMoney, formatSourceCount } from "@/domain/format";
import { netWorthChart } from "@/domain/networth-chart";
import {
  addMonths,
  compareMonths,
  currentDay,
  currentMonth,
  lastDayOfMonth,
} from "@/domain/time";
import { resolveChartRates } from "@/rates/chart-rates";
import { currentRateText } from "@/rates/label";
import { AddSourceForm } from "./AddSourceForm";
import { buildChartView } from "./chart-view";
import { NetWorthChart } from "./NetWorthChart";
import { SourceItem, type SourceView } from "./SourceItem";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Majątek — BuildYourWealth",
};

const GROUPS = [
  {
    kind: "savings",
    title: "Oszczędności",
    dot: styles.dotSave,
    pool: styles.poolSave,
  },
  {
    kind: "investments",
    title: "Inwestycje",
    dot: styles.dotInvest,
    pool: styles.poolInvest,
  },
] as const;

/** Suma w PLN albo `null`, gdy bez kursu nie da się jej policzyć (SPEC 7). */
function sumPln(rows: SourceRow[], rate: number | null): string | null {
  const total = netWorthPln(rows, rate);
  return total.ok ? formatMoney(total.pln, "PLN") : null;
}

function toView(row: SourceRow, rate: number | null): SourceView {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    currency: row.currency,
    valueText: formatMoney(row.value, row.currency),
    plnText:
      row.currency === "EUR" && rate !== null
        ? formatMoney(convertEurToPln(row.value, rate), "PLN")
        : null,
    kindLocked: row.kindLocked,
    form: {
      name: row.name,
      kind: row.kind,
      currency: row.currency,
      value: formatAmount(row.value),
      note: row.note ?? "",
    },
  };
}

/** Liczba miesięcy od `from` do `to` włącznie (`YYYY-MM`). */
function monthSpan(from: string, to: string): number {
  let count = 0;
  for (let m = from; compareMonths(m, to) <= 0; m = addMonths(m, 1)) count++;
  return count;
}

export default async function WealthPage() {
  const user = await requireUser();
  const db = getDb();
  const nowDate = now();
  const [rows, history] = await Promise.all([
    listSources(db, user.id),
    listSourceHistory(db, user.id),
  ]);

  // Wykres rysuje się od miesiąca pierwszego zapisu historii (SPEC 5.11). Kursy
  // EUR — bieżący do sumy majątku i kurs na koniec każdego miesiąca na wykres —
  // bierzemy jednym pobraniem z zakresu od tego miesiąca do dziś.
  const deploymentMonth = history.length
    ? currentMonth(history[0].recordedAt)
    : null;
  const ratesFrom = deploymentMonth
    ? lastDayOfMonth(deploymentMonth)
    : currentDay(nowDate);
  const chartRates = await resolveChartRates(db, user.id, ratesFrom, nowDate);

  // Majątek przelicza źródła EUR po bieżącym kursie NBP (SPEC 5.9, reguła 6.10)
  // i pokazuje użyty kurs z datą, gdy jest choć jedno źródło w EUR.
  const current = chartRates.current;
  const rate = current?.rate ?? null;
  const total = sumPln(rows, rate);
  const hasEur = rows.some((row) => row.currency === "EUR");

  // Stan wykresu: za mało punktów (miesiąc wdrożenia), brak kursu dla źródła EUR
  // albo gotowe punkty reguły 6.11.
  const chart =
    deploymentMonth &&
    monthSpan(deploymentMonth, currentMonth(nowDate)) >= 2
      ? netWorthChart({
          history,
          deploymentMonth,
          now: nowDate,
          rateForDay: chartRates.rateForDay,
          currentRate: rate,
        })
      : null;
  const chartView = chart?.ok ? buildChartView(chart.points) : null;

  return (
    <>
      <h1 className={styles.title}>Majątek</h1>

      {deploymentMonth !== null && (
        <section className={styles.card} aria-labelledby="wykres">
          <div className={styles.chartHead}>
            <h2 id="wykres" className={styles.groupTitle}>
              Wartość majątku
            </h2>
            {total !== null && <span className={styles.groupTotal}>{total}</span>}
          </div>
          {chartView ? (
            <NetWorthChart
              points={chartView.points}
              yLabels={chartView.yLabels}
              yMax={chartView.yMax}
            />
          ) : chart && !chart.ok ? (
            <p className={styles.chartMissing}>
              Ustaw kurs zapasowy EUR, żeby zobaczyć wykres.{" "}
              <Link href="/ustawienia" className={styles.summaryLink}>
                Ustaw kurs EUR
              </Link>
            </p>
          ) : (
            <p className={styles.chartHint}>
              Wykres pojawi się w przyszłym miesiącu.
            </p>
          )}
        </section>
      )}

      <section className={styles.summary} aria-labelledby="suma">
        <div className={styles.summaryMain}>
          <h2 id="suma" className={styles.summaryLabel}>
            Majątek łącznie ({formatSourceCount(rows.length)})
          </h2>
          {total !== null ? (
            <>
              <p className={styles.summaryTotal}>{total}</p>
              {hasEur && current !== null && (
                <p className={styles.summaryRate}>
                  Źródła EUR po kursie {currentRateText(current)}
                </p>
              )}
            </>
          ) : (
            <p className={styles.summaryMissing}>
              Ustaw kurs EUR, żeby zobaczyć sumę majątku.{" "}
              <Link href="/ustawienia" className={styles.summaryLink}>
                Ustaw kurs EUR
              </Link>
            </p>
          )}
        </div>
        <dl className={styles.summaryPools}>
          {GROUPS.map(({ kind, title, dot, pool }) => {
            const sum = sumPln(
              rows.filter((row) => row.kind === kind),
              rate,
            );
            return (
              <div key={kind} className={`${styles.summaryPool} ${pool}`}>
                <dt>
                  <span className={`${styles.dot} ${dot}`} />
                  {title}
                </dt>
                <dd>{sum ?? "wymaga kursu EUR"}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <div className={styles.groups}>
        {GROUPS.map(({ kind, title, dot }) => {
          const group = rows.filter((row) => row.kind === kind);
          const groupSum = sumPln(group, rate);
          return (
            <section
              key={kind}
              className={styles.card}
              aria-labelledby={`grupa-${kind}`}
            >
              <div className={styles.groupHead}>
                <h2 id={`grupa-${kind}`} className={styles.groupTitle}>
                  <span className={`${styles.dot} ${dot}`} />
                  {title}
                </h2>
                <span className={styles.groupTotal}>{groupSum ?? "—"}</span>
              </div>
              {group.length === 0 ? (
                <p className={styles.empty}>
                  {kind === "savings"
                    ? "Nie masz jeszcze źródeł oszczędności."
                    : "Nie masz jeszcze źródeł inwestycji."}
                </p>
              ) : (
                <ul className={styles.list}>
                  {group.map((row) => (
                    <SourceItem key={row.id} source={toView(row, rate)} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <section className={styles.card} aria-labelledby="dodaj">
        <h2 id="dodaj" className={styles.groupTitle}>
          Dodaj źródło
        </h2>
        <AddSourceForm />
      </section>
    </>
  );
}

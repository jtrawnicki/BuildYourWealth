import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { getEurRate } from "@/db/settings";
import { listSources, type SourceRow } from "@/db/sources";
import { convertEurToPln, netWorthPln } from "@/domain/currency";
import { formatAmount, formatMoney, formatSourceCount } from "@/domain/format";
import { AddSourceForm } from "./AddSourceForm";
import { SourceItem, type SourceView } from "./SourceItem";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Majątek — BuildYourWealth",
};

const GROUPS = [
  { kind: "savings", title: "Oszczędności", dot: styles.dotSave },
  { kind: "investments", title: "Inwestycje", dot: styles.dotInvest },
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

export default async function WealthPage() {
  const user = await requireUser();
  const db = getDb();
  const [rows, rate] = await Promise.all([
    listSources(db, user.id),
    getEurRate(db, user.id),
  ]);
  const total = sumPln(rows, rate);

  return (
    <>
      <h1 className={styles.title}>Majątek</h1>

      <section className={styles.summary} aria-labelledby="suma">
        <div className={styles.summaryMain}>
          <h2 id="suma" className={styles.summaryLabel}>
            Majątek łącznie ({formatSourceCount(rows.length)})
          </h2>
          {total !== null ? (
            <p className={styles.summaryTotal}>{total}</p>
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
          {GROUPS.map(({ kind, title, dot }) => {
            const sum = sumPln(
              rows.filter((row) => row.kind === kind),
              rate,
            );
            return (
              <div key={kind} className={styles.summaryPool}>
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
          return (
            <section
              key={kind}
              className={styles.card}
              aria-labelledby={`grupa-${kind}`}
            >
              <h2 id={`grupa-${kind}`} className={styles.groupTitle}>
                <span className={`${styles.dot} ${dot}`} />
                {title}
              </h2>
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

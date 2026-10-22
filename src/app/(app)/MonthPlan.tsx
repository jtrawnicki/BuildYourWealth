import Link from "next/link";
import type { Pool } from "@/domain/plan";
import styles from "./MonthPlan.module.css";

// Sekcja planu ekranu „Ten miesiąc" (makieta B1, SPEC 5.4, 8): zdanie
// „odkładasz X…", pasek podziału z legendą i karty przelewów z postępem celów.
// Komponent jest czysto prezentacyjny — kwoty, procenty i postęp liczy
// `page.tsx` z domeny; tutaj tylko układ i kolory z tokenów obu motywów.
//
// Miesiąc otwarty pokazuje plan (kwoty w PLN, cel w EUR z linią „≈ … €" albo
// linkiem do kursu). Miesiąc rozliczony pokazuje kwoty faktyczne jako główne
// liczby (SPEC 5.4), z planem w drugiej linii; pule, „do wydania" i pasek
// liczą się z wpłat przeliczonych kursem rozliczenia. Gdy wpłat nie da się
// sprowadzić do PLN (cel w EUR bez zapisanego kursu), `summable` jest false:
// znikają zdanie z kwotami i pasek, a sumy pul pokazują „—".

export type Progress =
  | { reached: true }
  | { reached: false; label: string; widthPct: number }
  | null;

export type TransferItem = {
  goalId: number;
  pool: Pool;
  name: string;
  sourceName: string;
  pctLabel: string;
  /** Główna kwota: plan (otwarty) albo wpłata faktyczna (rozliczony). */
  amountLabel: string;
  /** Druga linia kwoty: „≈ … €" (otwarty, EUR) albo „= … zł" (rozliczony, EUR). */
  amountNote: string | null;
  /** Otwarty miesiąc, cel w EUR bez kursu: zamiast kwoty EUR link do ustawień. */
  rateLink: boolean;
  /** Linia w kolumnie celu: plan w rozliczonym miesiącu („plan: … zł"). */
  planNote: string | null;
  progress: Progress;
};

export type PoolGroup = {
  pool: Pool;
  title: string;
  totalLabel: string;
  items: TransferItem[];
};

export type Segment = {
  key: "savings" | "investments" | "spend";
  pctLabel: string;
  widthPct: number;
};

export type LegendEntry = {
  key: "savings" | "investments" | "spend";
  label: string;
  amountLabel: string;
};

export type MonthPlanView = {
  /** Rozliczony miesiąc jest tylko do odczytu: kopia w czasie przeszłym. */
  settled: boolean;
  /** Czy kwoty da się zsumować w PLN (pasek, pule, zdanie z kwotami). */
  summable: boolean;
  setAsideLabel: string;
  toSpendLabel: string;
  segments: Segment[];
  legend: LegendEntry[];
  groups: PoolGroup[];
};

const SEGMENT_CLASS: Record<Segment["key"], string> = {
  savings: styles.segSavings,
  investments: styles.segInvestments,
  spend: styles.segSpend,
};

export function MonthPlan({ view }: { view: MonthPlanView }) {
  return (
    <section className={styles.plan} aria-label="Plan miesiąca">
      <Lead view={view} />
      {view.summable && (
        <div className={styles.split}>
          <div
            className={styles.bar}
            role="img"
            aria-label={`Podział przychodu: ${view.legend
              .map((entry) => `${entry.label} ${entry.amountLabel}`)
              .join(", ")}`}
          >
            {view.segments.map((segment) => (
              <div
                key={segment.key}
                className={`${styles.segment} ${SEGMENT_CLASS[segment.key]}`}
                style={{ width: `${segment.widthPct}%` }}
              >
                {segment.pctLabel}
              </div>
            ))}
          </div>
          <div className={styles.legend}>
            {view.legend.map((entry) => (
              <span key={entry.key} className={styles.legendItem}>
                <span
                  className={`${styles.swatch} ${SEGMENT_CLASS[entry.key]}`}
                  aria-hidden="true"
                />
                {entry.label} <strong>{entry.amountLabel}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {view.groups.length > 0 && (
        <div className={styles.transfers}>
          <div className={styles.transfersHead}>
            <h2 className={styles.transfersTitle}>
              {view.settled ? "Przelewy" : "Przelewy do wykonania"}
            </h2>
            {!view.settled && (
              <span className={styles.transfersHint}>
                Na koniec miesiąca potwierdzisz, ile faktycznie przelałeś.
              </span>
            )}
          </div>
          <div className={styles.cards}>
            {view.groups.map((group) => (
              <TransferCard key={group.pool} group={group} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Lead({ view }: { view: MonthPlanView }) {
  // Rozliczony miesiąc z wpłatami nieprzeliczalnymi na PLN: zdanie bez kwot.
  if (view.settled && !view.summable) {
    return (
      <p className={styles.lead}>
        Miesiąc rozliczony — wykonanie każdego celu niżej.
      </p>
    );
  }
  return (
    <p className={styles.lead}>
      {view.settled ? "W tym miesiącu odłożono" : "W tym miesiącu odkładasz"}{" "}
      <span className={styles.leadSet}>{view.setAsideLabel}</span>, a do wydania{" "}
      {view.settled ? "zostało" : "zostaje"} {view.toSpendLabel}.
    </p>
  );
}

function TransferCard({ group }: { group: PoolGroup }) {
  const dotClass =
    group.pool === "savings" ? styles.segSavings : styles.segInvestments;
  return (
    <section className={styles.card} aria-label={group.title}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>
          <span
            className={`${styles.cardDot} ${dotClass}`}
            aria-hidden="true"
          />
          {group.title}
        </span>
        <span className={styles.cardTotal}>{group.totalLabel}</span>
      </div>
      <ul className={styles.items}>
        {group.items.map((item) => (
          <TransferRow key={item.goalId} item={item} />
        ))}
      </ul>
    </section>
  );
}

function TransferRow({ item }: { item: TransferItem }) {
  const pctClass =
    item.pool === "savings" ? styles.pctSavings : styles.pctInvestments;
  const fillClass =
    item.pool === "savings" ? styles.fillSavings : styles.fillInvestments;
  return (
    <li className={styles.item} aria-label={item.name}>
      <span className={`${styles.pct} ${pctClass}`} aria-hidden="true">
        {item.pctLabel}
      </span>
      <div className={styles.itemMain}>
        <span className={styles.itemName}>{item.name}</span>
        <span className={styles.itemSource}>na: {item.sourceName}</span>
        {item.progress?.reached === false && (
          <div className={styles.progress}>
            <span className={styles.track}>
              <span
                className={`${styles.fill} ${fillClass}`}
                style={{ width: `${item.progress.widthPct}%` }}
              />
            </span>
            <span className={styles.progressLabel}>{item.progress.label}</span>
          </div>
        )}
        {item.progress?.reached === true && (
          <span className={styles.reached}>osiągnięty</span>
        )}
        {item.planNote !== null && (
          <span className={styles.actual}>{item.planNote}</span>
        )}
      </div>
      <span className={styles.itemAmount}>
        <span className={styles.amount}>{item.amountLabel}</span>
        {item.rateLink ? (
          <Link href="/ustawienia" className={styles.rateLink}>
            Ustaw kurs EUR
          </Link>
        ) : (
          item.amountNote !== null && (
            <span className={styles.eur}>{item.amountNote}</span>
          )
        )}
      </span>
    </li>
  );
}

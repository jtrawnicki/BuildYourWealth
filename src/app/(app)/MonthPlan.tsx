import Link from "next/link";
import type { DeadlineLine } from "@/domain/forecast-text";
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

/**
 * Prognoza celu pod paskiem postępu (SPEC 5.12, 8.1): wynik prognozy albo
 * status terminu jako pigułka; „zagrożony” prowadzi do Planu podziału.
 */
export type GoalForecastView = {
  line: { kind: "text"; text: string } | ({ kind: "deadline" } & DeadlineLine);
  /** Kolejne linie: brak danych przy terminie i dopisek o nowym procencie. */
  notes: string[];
};

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
  forecast: GoalForecastView | null;
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

const TILE_CLASS: Record<Segment["key"], string> = {
  savings: styles.tileSave,
  investments: styles.tileInvest,
  spend: styles.tileSpend,
};

export function MonthPlan({ view }: { view: MonthPlanView }) {
  // Procent obok kwoty na kafelku bierzemy z segmentu paska; kategoria o kwocie
  // 0 nie ma segmentu, więc zostaje sama nazwa.
  const pctByKey = new Map(view.segments.map((s) => [s.key, s.pctLabel]));

  return (
    <section className={styles.plan} aria-label="Plan miesiąca">
      {view.summable ? (
        <div className={styles.hero}>
          <Lead view={view} />
          <div className={styles.heroSplit}>
            <div
              className={styles.bar}
              role="img"
              aria-label={`Podział przychodu: ${view.legend
                .map((entry) => `${entry.label} ${entry.amountLabel}`)
                .join(", ")}`}
            >
              {view.segments.map((segment) => (
                <span
                  key={segment.key}
                  className={`${styles.segment} ${SEGMENT_CLASS[segment.key]}`}
                  style={{ width: `${segment.widthPct}%` }}
                />
              ))}
            </div>
            <div className={styles.tiles}>
              {view.legend.map((entry) => (
                <div
                  key={entry.key}
                  className={`${styles.tile} ${TILE_CLASS[entry.key]}`}
                >
                  <span className={styles.tileAmount}>{entry.amountLabel}</span>
                  <span className={styles.tileLabel}>
                    {entry.label}
                    {pctByKey.has(entry.key) && ` · ${pctByKey.get(entry.key)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Lead view={view} />
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
  if (!view.summable) {
    return (
      <p className={styles.leadMessage}>
        Miesiąc rozliczony — wykonanie każdego celu niżej.
      </p>
    );
  }
  return (
    <div className={styles.lead}>
      <span className={styles.leadLabel}>
        {view.settled ? "W tym miesiącu odłożono" : "Odkładasz w tym miesiącu"}
      </span>
      <span className={styles.leadNum}>{view.setAsideLabel}</span>
      <span className={styles.leadRest}>
        Do wydania {view.settled ? "zostało" : "zostaje"}{" "}
        <strong>{view.toSpendLabel}</strong>
      </span>
    </div>
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
        {item.forecast !== null && <GoalForecast forecast={item.forecast} />}
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

const STATUS_CLASS: Record<DeadlineLine["status"], string> = {
  "on-track": styles.statusOk,
  "at-risk": styles.statusWarn,
  overdue: styles.statusNeutral,
  "no-data": styles.statusNeutral,
};

function GoalForecast({ forecast }: { forecast: GoalForecastView }) {
  const { line } = forecast;
  return (
    <>
      {line.kind === "text" ? (
        <span className={styles.forecast}>{line.text}</span>
      ) : (
        <span className={styles.forecast}>
          {line.deadline} ·{" "}
          {line.status === "at-risk" ? (
            <Link
              href="/plan"
              className={`${styles.status} ${styles.statusLink} ${STATUS_CLASS[line.status]}`}
            >
              {line.statusLabel}
            </Link>
          ) : (
            <span className={`${styles.status} ${STATUS_CLASS[line.status]}`}>
              {line.statusLabel}
            </span>
          )}
          {line.detail !== null && ` ${line.detail}`}
        </span>
      )}
      {forecast.notes.map((note) => (
        <span key={note} className={styles.forecastNote}>
          {note}
        </span>
      ))}
    </>
  );
}

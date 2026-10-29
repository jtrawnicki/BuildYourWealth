import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { listHistory, type HistoryMonth } from "@/db/months";
import { convertEurToPln } from "@/domain/currency";
import { formatMoney, formatPercent } from "@/domain/format";
import { formatMonthTitle } from "@/domain/month-name";
import { computeMonthPlan, type Pool } from "@/domain/plan";
import { settledRateText } from "@/rates/label";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Historia — BuildYourWealth",
};

// Ekran Historia (SPEC 5.6): lista miesięcy od najnowszego z przychodem, planem
// i wykonaniem dla każdej puli i celu oraz statusem. Plan liczy się z migawki
// miesiąca, więc zmiana planu nie zmienia historii (scen. 8); wykonanie EUR jest
// w EUR i w PLN po kursie zapisanym przy rozliczeniu, więc zmiana kursu później
// jej nie rusza (SPEC 6.9). Nierozliczony miesiąc ma link do edycji przychodów.
export default async function HistoryPage() {
  const user = await requireUser();
  const months = await listHistory(getDb(), user.id);

  return (
    <>
      <h1 className={styles.title}>Historia</h1>
      {months.length === 0 ? (
        <p className={styles.empty}>
          Nie masz jeszcze żadnych miesięcy. Wpisz przychód w „Ten miesiąc”.
        </p>
      ) : (
        <ol className={styles.months}>
          {months.map((month) => (
            <li key={month.month}>
              <MonthCard view={buildMonthView(month)} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

const POOL_TITLE: Record<Pool, string> = {
  savings: "Oszczędności",
  investments: "Inwestycje",
};

type GoalView = {
  goalId: number;
  name: string;
  pctLabel: string;
  planLabel: string;
  /** Wykonanie w walucie źródła; `null`, dopóki miesiąc nierozliczony. */
  actualLabel: string | null;
  /** Dla celu EUR wykonanie po kursie rozliczenia, np. `= 387,00 zł`. */
  actualPlnNote: string | null;
};

type PoolView = {
  pool: Pool;
  title: string;
  planLabel: string;
  /** Suma wykonania puli w PLN; `null` dla miesiąca nierozliczonego. */
  actualLabel: string | null;
  items: GoalView[];
};

type MonthView = {
  month: string;
  title: string;
  settled: boolean;
  statusLabel: string;
  incomeLabel: string;
  /** Kurs rozliczenia z pochodzeniem (SPEC 5.6); `null` bez celu EUR. */
  rateLabel: string | null;
  pools: PoolView[];
  /** Edycja przychodów nierozliczonego miesiąca (SPEC 5.4); `null` dla rozliczonego. */
  editHref: string | null;
};

/**
 * Składa widok miesiąca Historii z migawki i obliczeń domeny. Plan celu to część
 * puli z migawki (SPEC 6.1–6.5); wykonanie bierze się z faktycznych wpłat, a cel
 * EUR sprowadzamy do PLN kursem rozliczenia (SPEC 6.8).
 */
function buildMonthView(month: HistoryMonth): MonthView {
  const plan = computeMonthPlan({
    income: month.income,
    savingsPct: month.savingsPct,
    investmentsPct: month.investmentsPct,
    goals: month.goals.map((goal) => ({
      id: goal.goalId,
      pool: goal.pool,
      pct: goal.pct,
    })),
  });
  const planByGoal = new Map(plan.goals.map((goal) => [goal.id, goal.amount]));

  // Wykonanie celu sprowadzone do PLN: EUR po kursie rozliczenia (gwarantowanym
  // dla rozliczonego miesiąca z celem EUR), PLN bez przeliczenia.
  const actualPln = (goal: HistoryMonth["goals"][number]) => {
    const actual = goal.actualAmount ?? 0;
    if (goal.currency === "PLN") return actual;
    return month.settledEurRate !== null
      ? convertEurToPln(actual, month.settledEurRate)
      : 0;
  };

  const pools: PoolView[] = [];
  for (const pool of ["savings", "investments"] as const) {
    const goalsInPool = month.goals.filter((goal) => goal.pool === pool);
    if (goalsInPool.length === 0) continue;

    const items = goalsInPool.map((goal): GoalView => {
      const planAmount = planByGoal.get(goal.goalId) ?? 0;
      if (!month.settled) {
        return {
          goalId: goal.goalId,
          name: goal.name,
          pctLabel: formatPercent(goal.pct),
          planLabel: formatMoney(planAmount, "PLN"),
          actualLabel: null,
          actualPlnNote: null,
        };
      }
      const actual = goal.actualAmount ?? 0;
      return {
        goalId: goal.goalId,
        name: goal.name,
        pctLabel: formatPercent(goal.pct),
        planLabel: formatMoney(planAmount, "PLN"),
        actualLabel: formatMoney(actual, goal.currency),
        actualPlnNote:
          goal.currency === "EUR" && month.settledEurRate !== null
            ? `= ${formatMoney(convertEurToPln(actual, month.settledEurRate), "PLN")}`
            : null,
      };
    });

    const planSum = goalsInPool.reduce(
      (sum, goal) => sum + (planByGoal.get(goal.goalId) ?? 0),
      0,
    );
    pools.push({
      pool,
      title: POOL_TITLE[pool],
      planLabel: formatMoney(planSum, "PLN"),
      actualLabel: month.settled
        ? formatMoney(
            goalsInPool.reduce((sum, goal) => sum + actualPln(goal), 0),
            "PLN",
          )
        : null,
      items,
    });
  }

  // Kurs rozliczenia pokazujemy tylko dla miesiąca z celem EUR; wtedy kurs
  // i pochodzenie są zapisane (CHECK spójności, T19a). Miesiąc bez celu EUR
  // nie ma kursu (scen. 39).
  const rateLabel =
    month.settledEurRate !== null && month.settledRateSource !== null
      ? settledRateText(
          month.settledEurRate,
          month.settledRateSource,
          month.settledRateDate,
        )
      : null;

  return {
    month: month.month,
    title: formatMonthTitle(month.month),
    settled: month.settled,
    statusLabel: month.settled ? "Rozliczony" : "Otwarty",
    incomeLabel: formatMoney(month.income, "PLN"),
    rateLabel,
    pools,
    editHref: month.settled ? null : `/przychody/${month.month}`,
  };
}

function MonthCard({ view }: { view: MonthView }) {
  const headingId = `historia-${view.month}`;
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.cardHead}>
        <h2 id={headingId} className={styles.cardTitle}>
          {view.title}
        </h2>
        <span
          className={`${styles.status} ${view.settled ? styles.statusSettled : styles.statusOpen}`}
        >
          {view.statusLabel}
        </span>
      </div>

      <p className={styles.income}>
        <span className={styles.incomeLabel}>Przychód</span>
        <span className={styles.incomeAmount}>{view.incomeLabel}</span>
      </p>

      {view.rateLabel !== null && (
        <p className={styles.rate}>Kurs {view.rateLabel}</p>
      )}

      <div className={styles.pools}>
        {view.pools.map((pool) => (
          <div key={pool.pool} className={styles.pool}>
            <div className={styles.poolHead}>
              <span
                className={`${styles.dot} ${pool.pool === "savings" ? styles.dotSave : styles.dotInvest}`}
              />
              <span className={styles.poolTitle}>{pool.title}</span>
              <span className={styles.poolTotals}>
                <span className={styles.plan}>plan {pool.planLabel}</span>
                {pool.actualLabel !== null && (
                  <span className={styles.actual}>
                    wykonanie {pool.actualLabel}
                  </span>
                )}
              </span>
            </div>
            <ul className={styles.goals}>
              {pool.items.map((goal) => (
                <li key={goal.goalId} className={styles.goal}>
                  <span className={styles.goalName}>
                    {goal.name}
                    <span className={styles.goalPct}>{goal.pctLabel}</span>
                  </span>
                  <span className={styles.goalAmounts}>
                    <span className={styles.plan}>plan {goal.planLabel}</span>
                    {goal.actualLabel !== null && (
                      <span className={styles.actual}>
                        wykonanie {goal.actualLabel}
                        {goal.actualPlnNote !== null && (
                          <span className={styles.note}>
                            {" "}
                            {goal.actualPlnNote}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {view.editHref !== null && (
        <Link href={view.editHref} className={styles.editLink}>
          Edytuj przychody
        </Link>
      )}
    </section>
  );
}
